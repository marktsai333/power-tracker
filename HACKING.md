# 改功能速查表

給未來的自己看的。完整原理見下方「運作原理」。

## 發新版的步驟（照做，不然手機上不會更新）

改完程式後，**同時**改這兩個地方，版本號要一致：

1. `index.html` 的 `const VERSION = "1.1.0"`
2. `sw.js` 的 `const CACHE = "power-tracker-v1.1.0"`

改 CACHE 名稱是關鍵——service worker 靠它判斷有沒有新版，名稱一變就會重抓所有檔案、刪掉舊快取。
兩邊沒同步的話，App 裡顯示的版本會跟實際跑的程式對不上。

推上去之後，手機打開 App →「設定與資料 → 檢查更新」，會自動抓新版並重新載入。
（不按也會更新，只是要開第二次才生效。）

改了圖示或 App 名稱，要重跑 `python3 make_splash.py`，它會重新產生 `splash/` 並印出要貼進
`index.html` `<head>` 的那 24 行 `<link>` 標籤。

## 開發流程

```bash
cd ~/power-tracker && python3 -m http.server 8731
```

瀏覽器開 http://localhost:8731 邊改邊看（localhost 算安全來源，PWA 功能可正常測試）。

改完推上去：

```bash
cd ~/power-tracker && git add -A && git commit -m "說明改了什麼" && git push
```

約 1 分鐘 GitHub Pages 更新。手機上要**重新整理第二次**才看到新版（service worker 快取優先）。
想一推就生效，把上面那兩個版本號 +1，舊快取會整個作廢。

## 常見修改對照表

| 想改的東西 | 位置 |
|---|---|
| 電價 / 結算日預設值 | `load()` 裡的 `: 6` 和 `: 15` |
| 結算週期算法 | `boundary()` / `cycleOf()` / `cycles()` |
| 本期預估帳單 | `renderSummary()` 的 “current billing cycle” 段 |
| 歷史帳單卡片 | `renderBills()` |
| 顏色 / 字級 / 間距 | 檔頭 `<style>`。顏色都是 CSS 變數（`--series-1` 等），改一處全站套用 |
| 上方卡片顯示的數字 | `renderSummary()` |
| 圖表長相 | `renderChart()`。折線 / 柱狀兩種畫法在同一個 `if (mode === "bar")` 分支裡 |
| 橫軸分格 | `buckets()`。把每個抄表區間按時間倒進它跨到的整日 / 整週 / 整月裡，每格記下 `exact`（整段都在格內＝實測）、`split`（跨格分攤）、`proj`（推估）|
| 日 / 週 / 月的邊界 | `UNIT` 表裡的 `start` / `next`。`next` 一律先超過再退回整點，夏令時間和大小月才不會漂掉 |
| 哪些單位可選 | `unitsFor()`：跨度要夠（`MIN_SPAN`）、格數要在 2 到「畫面寬 ÷ 8」之間。只剩一種時整排 `#unitRow` 隱藏 |
| 預設選哪個單位 | `renderChart()` 裡的 `auto`：最細且格數不超過「畫面寬 ÷ 14」的那個 |
| 深淺代表什麼 | `solidity()`：≥ 半數實測＝不透明，多半是分攤＝ .55，那一格還沒抄完整＝ .28 |
| 推估怎麼算 | `buckets()` 用 `recentPerDay()`（近 30 天日均）補最後一筆抄表之後的空白，畫成虛線框 |
| 預設圖表形式 | `load()` 裡的 `s.chartMode === "bar" ? "bar" : "line"`（目前預設折線） |
| 預設時間單位 | `load()` 裡的 `chartUnit`，預設 `"auto"`（交給 `renderChart()` 挑）|
| 清單每行文字 | `renderList()` |
| 就地編輯表單 | `editRow()`，開關狀態存在模組層的 `editing`（值是那一列的 `d`） |
| 日期時間解析 / 顯示 | `ts()` / `dayOf()` / `timeOf()` / `fmtFull()` / `fmtDur()` |
| 新增紀錄的驗證邏輯 | `addReading()` |

> 紀錄的鍵 `d` 是 `YYYY-MM-DDTHH:MM`，舊資料的 `YYYY-MM-DD` 一律視同當日 00:00。
> 兩種格式都能用字串直接排序，不要改成 Date 物件比大小。
| 推估的時間窗（30 天 → 60 天） | `recentPerDay()`；卡片與圖表共用同一個日均 |
| 匯出格式 | `exportJSON()` / `exportCSV()` |

## 加新功能的路徑

**加一個顯示欄位**（例：本月至今花費）
1. HTML 加 `<div id="xxx">`
2. `renderSummary()` 裡算好塞進去

**加一個設定項**（例：每月預算）
1. `state` 加欄位
2. HTML 加 `<input>`
3. 「wire up」區綁 `change` 事件 → `state.xxx = 值; save(); renderAll();`

> ⚠️ **改 state 結構時務必給預設值。** `load()` 讀的是使用者手機裡的舊 JSON，新欄位在舊資料裡是 `undefined`。
> 照現有寫法處理：`Number(s.price) > 0 ? Number(s.price) : 6`

## 運作原理（三十秒版）

**單向資料流，沒有框架，任何改動都是同一個套路：**

```
        load()  ←── localStorage        開 App 時讀一次
          ↓
        state   { price, settleDay, chartMode, chartUnit, readings[] }
          ↓
      renderAll()
          ├── renderSummary()   → 上方卡片
          ├── renderChart()     → SVG 折線 / 長條圖（橫軸＝整日 / 整週 / 整月）
          ├── renderBills()     → 歷史帳單
          └── renderList()      → 下方清單
```

1. 改 `state` → 2. `save()` → 3. `renderAll()`（整個畫面重畫）

資料只有幾十筆，全部重畫是幾毫秒的事。刻意不用框架，換取「看得懂、改得動」。

**核心計算 `intervals()`** — 整個 App 的心臟。電表是累計值，`5539.1` 本身無意義；
有意義的是相鄰兩筆的差。它把 N 筆讀數轉成 N−1 段區間，每段算出 `days` / `used` / `perDay`。
卡片、每根柱子、清單每一行，全部從這個陣列長出來。

**`windowUsage()`** — 算「最近 30 天」時區間可能被界線切一半，它按比例分攤，
讓預估金額不會因為抄表間隔不規則而亂跳。結算週期（15 號到 15 號）也靠它切帳，
所以抄表日不必剛好落在 15 號。

**`sw.js`** — 攔截所有檔案請求，策略是「先給快取的、背景偷抓新的」。
所以離線可用，代價是新版要開第二次才生效。

**資料儲存** — 全部在 `localStorage` 的單一 key `powerTracker.v1`，值是一串 JSON。
不上網、不同步。換手機要用「匯出 JSON」搬。
