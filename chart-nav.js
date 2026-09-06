/* View-only navigation: never writes meter data or persists a stale date window. */
const chartNavigation = (() => {
  let windowTime = null, rows = [], visible = [], start = 0, count = 0;
  let wired = false, drag = null, touch = null, left = 0, width = 1;
  const api = { dragging: false, suppressClick: false, slice, connect };
  const $ = id => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function slice(data) {
    rows = data;
    start = 0; count = data.length;
    if (windowTime && data.length) {
      start = data.findIndex(d => d.e > windowTime[0]);
      if (start < 0) start = data.length - 1;
      let end = data.findIndex(d => d.b >= windowTime[1]);
      if (end < 0) end = data.length;
      count = clamp(end - start, Math.min(3, data.length), data.length);
      start = clamp(start, 0, data.length - count);
    }
    visible = data.slice(start, start + count);
    return visible;
  }
  function setWindow(s, n) {
    if (!rows.length) return;
    n = clamp(Math.round(n), Math.min(3, rows.length), rows.length);
    s = clamp(Math.round(s), 0, rows.length - n);
    windowTime = n === rows.length ? null : [rows[s].b, rows[s + n - 1].e];
    hideTip(); renderChart();
  }
  function zoom(factor, anchor = .5) {
    const n = clamp(Math.round(count * factor), Math.min(3, rows.length), rows.length);
    setWindow(start + (count - n) * anchor, n);
  }
  function connect(all, data, unit, l, w) {
    left = l; width = w;
    $('chartNav').hidden = false;
    $('chartOverview').toggleAttribute('hidden', all.length < 2);
    const fmt = t => new Date(t).toLocaleDateString('zh-TW', {year:'numeric',month:'numeric',day:'numeric'});
    $('chartRangeLabel').textContent = fmt(data[0].b) + '–' + fmt(data[data.length - 1].e - 1);
    $('chartZoomIn').disabled = count <= Math.min(3, all.length);
    $('chartZoomOut').disabled = count === all.length;
    $('chartReset').disabled = count === all.length;
    $('chartHint').textContent = '雙指縮放、左右拖曳看日期；點選看明細。也可使用 ＋／−。';
    const svg = $('chartOverview');
    svg.setAttribute('viewBox', '0 0 400 44');
    svg.replaceChildren();
    const max = Math.max(...all.map(d => d.kwh + d.proj), 1);
    const make = (tag, attrs) => {
      const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k,v)); svg.appendChild(e);
    };
    make('rect', {x:0,y:4,width:400,height:36,rx:6,fill:'var(--gridline)'});
    const point = (d,i) => `${(i+.5)*400/all.length},${37-(d.kwh+d.proj)/max*27}`;
    const projected = all.findIndex(d => d.proj > 0);
    const cut = projected < 0 ? all.length : projected;
    if (cut) {
      const points = all.slice(0,cut).map(point).join(' ');
      make('polygon', {points:`${.5*400/all.length},38 ${points} ${(cut-.5)*400/all.length},38`,
        fill:'var(--series-1)',opacity:.22});
      make('polyline', {points,fill:'none',stroke:'var(--series-1)','stroke-width':1.3,opacity:.55});
    }
    if (projected >= 0) {
      const from = Math.max(0,projected-1);
      make('polyline', {points:all.slice(from).map((d,i)=>point(d,i+from)).join(' '),
        fill:'none',stroke:'var(--series-1)','stroke-width':1.3,'stroke-dasharray':'3 2',opacity:.55});
    }
    const x = start/all.length*398+1, selectionWidth = count/all.length*398;
    make('rect', {x,y:5,width:selectionWidth,height:34,rx:5,
      fill:'var(--series-1)','fill-opacity':.12,stroke:'var(--series-1)','stroke-width':1.5});
    if (selectionWidth > 24) for (const edge of [x+5,x+selectionWidth-5]) {
      make('line', {x1:edge,x2:edge,y1:17,y2:27,stroke:'var(--series-1)','stroke-width':2,'stroke-linecap':'round'});
    }
    if (wired) return;
    wired = true;
    $('chartZoomIn').onclick = () => zoom(.5);
    $('chartZoomOut').onclick = () => zoom(2);
    $('chartReset').onclick = () => setWindow(0, rows.length);
    wireMouse($('chartBox'), false); wireMouse(svg, true);
    wireTouch($('chartBox'), false); wireTouch(svg, true);
    $('chartBox').addEventListener('wheel', e => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault(); zoom(e.deltaY < 0 ? .8 : 1.25, anchor(e.clientX));
    }, {passive:false});
  }
  function anchor(x) {
    const r = $('chartBox').getBoundingClientRect();
    return clamp(((x-r.left)/r.width-left)/width,0,1);
  }
  function finish() {
    drag = null; api.dragging = false;
    setTimeout(() => { api.suppressClick = false; }, 0);
  }
  function wireMouse(el, overview) {
    el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      api.suppressClick = false;
      drag = {x:e.clientX,s:start,n:count}; el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!drag || e.pointerType === 'touch') return;
      const dx = e.clientX-drag.x;
      if (Math.abs(dx)<5 && !api.dragging) return;
      api.dragging = api.suppressClick = true;
      const scale = overview ? rows.length : -drag.n/width;
      setWindow(drag.s+dx/el.clientWidth*scale,drag.n);
    });
    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', finish);
  }
  function wireTouch(el, overview) {
    const distance = touches => Math.hypot(touches[1].clientX-touches[0].clientX,touches[1].clientY-touches[0].clientY);
    el.addEventListener('touchstart', e => {
      api.suppressClick = false;
      const t = e.touches;
      touch = {x:t[0].clientX,y:t[0].clientY,s:start,n:count,
        dist:t.length===2?distance(t):0,
        a:t.length===2?anchor((t[0].clientX+t[1].clientX)/2):.5};
      if (t.length===2) { e.preventDefault(); api.suppressClick = true; }
    }, {passive:false});
    el.addEventListener('touchmove', e => {
      if (!touch) return;
      const t=e.touches;
      if (t.length===2 && touch.dist) {
        e.preventDefault(); api.dragging=api.suppressClick=true;
        const n=clamp(Math.round(touch.n*touch.dist/Math.max(1,distance(t))),Math.min(3,rows.length),rows.length);
        setWindow(touch.s+(touch.n-n)*touch.a,n);
      } else if(t.length===1 && !touch.dist) {
        const dx=t[0].clientX-touch.x, dy=t[0].clientY-touch.y;
        if(!api.dragging && Math.abs(dy)>Math.abs(dx)) return;
        if(Math.abs(dx)<6 && !api.dragging) return;
        e.preventDefault(); api.dragging=api.suppressClick=true;
        setWindow(touch.s+dx/el.clientWidth*(overview?rows.length:-touch.n/width),touch.n);
      }
    }, {passive:false});
    const end = () => { touch=null; api.dragging=false; /* suppress synthetic click until next touch */ };
    el.addEventListener('touchend',end); el.addEventListener('touchcancel',end);
  }
  return api;
})();
