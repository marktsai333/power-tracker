# AGENTS.md

給 AI 助手看的專案指引。實作細節看 `HACKING.md`，這份只寫「程式碼裡看不出來的事」。

## 這是什麼

個人用的電費追蹤 PWA。使用者在租屋處自己抄電表（累計度數），房東每月 15 號結算，
單價 NT$6/度。抄表時間不固定 —— 可能一天抄兩次，也可能兩週才抄一次。
整個 App 是單一檔案 `index.html`（HTML + CSS + JS 全在裡面），加一個 `sw.js`。
沒有框架、沒有建置步驟、沒有相依套件。

部署在 GitHub Pages：<https://marktsai333.github.io/power-tracker/>

## 跟使用者互動的規則

1. **一律用中文回覆。** 使用者用中文，回覆不要漂移成英文。
2. **改 UI 之前先給靜態 mockup，等對方點頭再動真的程式碼。** 這是明確要求過的，
   不是建議。做法：另外開一個 `mockup.html`，用 `python3 -m http.server` 給他看，
   談定之後再改 `index.html`，最後把 mockup 刪掉。
3. **不要用 `rm`。** 要刪檔案用 `trash <檔案>`（可以從垃圾桶救回來）。
   真的需要永久刪除，先問清楚再做。
4. **危險操作（`git reset`、force push、改設定）一定要先問。** 沉默不等於同意。
   任何可能丟掉未提交內容的指令之前，先跑 `git status`。
5. **講結果要老實。** 測試沒過就說沒過並附輸出；跳過的步驟要講。不要用「應該可以」帶過。

## 這個 repo 的地雷

**中文字串裡有 NBSP。** `index.html` 的單位字串用的是不斷行空格（`\xa0`），
例如 `"\xa0度"`、`"\xa0元"`、`" 天 · "`。用精確字串比對去改這些地方會**無聲失敗** ——
比對不到、也不會報錯。先用 `repr()` 看清楚實際位元組，或改用 `.` 萬用字元的 regex。

**兩個版本號必須一起改。** `index.html` 的 `const VERSION` 和 `sw.js` 的 `const CACHE`
要同步。service worker 靠 cache 名稱判斷有沒有新版，名稱沒變 = 手機吃舊快取，
使用者看不到你的修改。這是最容易忘、後果最煩的一件事。

**單一檔案，衝突很痛。** `index.html` 一千三百多行。不要跟其他工具同時改這個 repo，
動之前先 `git pull`。

**改 state 結構一定要給預設值。** `load()` 讀的是使用者手機裡存的舊 JSON，
新欄位在舊資料裡是 `undefined`。照現有寫法處理，不要假設欄位存在。

**CSS 的 class `display` 會蓋掉 `[hidden]`。** 已經被咬過一次：`.chart-range { display: flex }`
讓 `hidden` 屬性失效，元素該藏沒藏。加了 `.chart-range[hidden] { display: none }` 才修好。
之後新增有 `display` 的 class 又要用 `hidden` 控制時，記得補這條。

## 怎麼驗證改動

沒有測試框架，用 headless Chrome 跑。這套流程有效，建議沿用：

```bash
# 1. 起本機伺服器
cd ~/Projects/power-tracker && python3 -m http.server 8731

# 2. 寫一個 _t.html 測試頁：用 iframe 載入 index.html，
#    載入前先 localStorage.setItem("powerTracker.v1", ...) 塞好測試資料，
#    載入後直接讀 iframe 的 DOM 和 window 上的函式來斷言，
#    結果寫進頁面上的 <pre>

# 3. 用 --dump-dom 把結果撈出來
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --virtual-time-budget=12000 --dump-dom "http://127.0.0.1:8731/_t.html"
```

幾個踩過的坑：

- **把整個測試 IIFE 包在 try/catch 裡**，錯誤印進 `<pre>`。不然它在第一行就丟例外，
  頁面完全空白，你會以為是伺服器掛了。
- 頂層用 `const` 宣告的箭頭函式（`ts`、`fmtMD` 等）**不會**掛到 `window` 上，
  iframe 外面拿不到。`function` 宣告的（`intervals`、`buckets`、`renderChart` 等）才拿得到。
- 斷言失敗時先懷疑自己的斷言，不要急著改程式 —— 上次 25 條裡有 2 條是測試寫錯。
- 測試檔取名 `_` 開頭，做完用 `trash` 清掉，不要 commit 進 repo。
- 視覺確認用 `--screenshot`，但 `--window-size=390` 出來的 layout viewport 會比較寬、
  右邊會被切掉。用 `--window-size=1100,1500` 拍完再用 PIL 裁 390 寬的區域。
- **每一種變體都要實際看過再說「修好了」** —— 日/週/月、折線/柱狀、久未抄表、
  舊的純日期資料、0 筆和 1 筆紀錄。不要用單一指標代替全面檢查。

## 目前狀態（2026-09-07）

**v1.5.0，已完成並部署。工作目錄乾淨，沒有進行到一半的東西。**

最近一次大改動是趨勢圖重做（commit `ba728e6`）。設計理由如下，這些只有結論在程式碼裡：

原本橫軸是「一筆抄表佔一格」，導致一天抄兩次和兩週抄一次被畫成一樣寬。
中間試過「橫軸＝實際時間、柱寬＝區間長度」的版本（v1.4.0），使用者的評價是
「整個變得很怪」，並要求先去參考別人怎麼做。查過 OUC、Home Assistant energy dashboard
等等之後確認：**業界慣例是切成整齊的日曆分格、等寬柱子、外加日/週/月粒度切換器**，
而不是自創的變寬柱狀圖。現在的做法就是這個慣例。

隨之而來的問題是「一格裡的用電量怎麼算」。答案是把每個抄表區間**按時間比例分攤**到
它跨到的每一格。所以一天抄三次時，那天的柱子 = 昨天最後一段切進今天的頭 + 今天實際量到的兩段。

因為分攤出來的數字不是實測值，圖上用深淺區分（`solidity()`）：實測、分攤、資料不完整
各有不同透明度，配上圖例。**這個「不假裝猜測是量測」的原則要保持**，
之後加任何推估功能都應該在視覺上標示出來。

最後一筆抄表之後的空白（今天剩下的時間、整個沒去抄的月份）用近 30 天日均推估，
畫成虛線框、折線模式畫虛線加空心點。使用者在兩個選項（留空 vs 推估補上）中選了推估。

順帶砍掉了原本的「30 天 / 90 天 / 全部」範圍切換器 —— 使用者說「不知道可以幹嘛」，
確實沒有明確用途，改成日/週/月的單位切換器。

## 使用者資料的處理

全部在 `localStorage` 單一 key `powerTracker.v1`，不上網、不同步。結構長這樣：

```json
{
  "price": 6,
  "settleDay": 15,
  "chartMode": "line",
  "chartUnit": "auto",
  "readings": [{ "d": "2026-08-15T08:30", "k": 5429.9 }]
}
```

`d` 是 `YYYY-MM-DDTHH:MM`，舊資料的 `YYYY-MM-DD` 一律視同當日 00:00；
兩種格式都能用字串直接排序，不要改成 Date 物件比大小。
`k` 是電表累計讀數，本身無意義，有意義的是相鄰兩筆的差。

使用者手機裡的抄表紀錄是真實資料，測試時**不要**動到他的瀏覽器 profile，
測試資料一律塞在測試頁自己的 origin 裡。
