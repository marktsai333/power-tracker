/* The chart always opens near now; horizontal dragging is for looking backward. */
const chartNavigation = (() => {
  let rows = [], start = 0, count = 0, unit = null, wasAtLatest = true;
  let resetOnNextSlice = false;
  let wired = false, touch = null;
  const api = { dragging: false, suppressClick: false, slice, connect, selectUnit };
  const $ = id => document.getElementById(id);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const defaultCount = u => ({ day: 14, week: 12, month: 12 })[u] || 12;

  function latest() {
    count = clamp(defaultCount(unit), Math.min(3, rows.length), rows.length);
    start = rows.length - count;
    wasAtLatest = true;
  }
  function slice(data, nextUnit) {
    const changedUnit = resetOnNextSlice || unit !== nextUnit;
    const lastRow = rows[rows.length - 1], lastData = data[data.length - 1];
    const changedData = rows.length !== data.length || lastRow?.e !== lastData?.e;
    rows = data; unit = nextUnit;
    resetOnNextSlice = false;
    if (!rows.length) return [];
    if (changedUnit || (changedData && wasAtLatest)) latest();
    else {
      count = clamp(count || defaultCount(unit), Math.min(3, rows.length), rows.length);
      start = clamp(start, 0, rows.length - count);
      wasAtLatest = start + count === rows.length;
    }
    return rows.slice(start, start + count);
  }
  function selectUnit() { resetOnNextSlice = true; }
  function move(nextStart) {
    start = clamp(Math.round(nextStart), 0, rows.length - count);
    wasAtLatest = start + count === rows.length;
    hideTip(); renderChart();
  }
  function connect(all, data) {
    $('chartHistory').hidden = false;
    const fmt = t => new Date(t).toLocaleDateString("zh-TW", { month:"numeric", day:"numeric" });
    $('chartRangeLabel').textContent = fmt(data[0].b) + "–" + fmt(data[data.length - 1].e - 1);
    $('chartToday').hidden = wasAtLatest;
    $('chartHint').textContent = "左右滑動查看歷史資料 · 點一下看明細。";
    if (wired) return;
    wired = true;
    $('chartToday').onclick = () => { latest(); renderChart(); };
    const box = $('chartBox');
    box.addEventListener("touchstart", e => {
      if (e.touches.length !== 1) return;
      touch = { x:e.touches[0].clientX, y:e.touches[0].clientY, start };
      api.dragging = api.suppressClick = false;
    }, { passive:true });
    box.addEventListener("touchmove", e => {
      if (!touch || e.touches.length !== 1) return;
      const point = e.touches[0], dx = point.clientX - touch.x, dy = point.clientY - touch.y;
      if (!api.dragging && Math.abs(dy) >= Math.abs(dx)) return;
      if (!api.dragging && Math.abs(dx) < 8) return;
      e.preventDefault();
      api.dragging = api.suppressClick = true;
      move(touch.start - dx / box.clientWidth * count);
    }, { passive:false });
    const end = () => { touch = null; api.dragging = false; setTimeout(() => { api.suppressClick = false; }, 0); };
    box.addEventListener("touchend", end); box.addEventListener("touchcancel", end);
  }
  return api;
})();
