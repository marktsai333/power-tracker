# 改功能速查表

給未來的自己看的。完整原理見下方「運作原理」。

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
想一推就生效，把 `sw.js` 的 `CACHE = "power-tracker-v1"` 版本號 +1，舊快取會整個作廢。

## 常見修改對照表

| 想改的東西 | 位置 |
|---|---|
| 電價預設值 | `load()` 裡的 `: 6` |
| 顏色 / 字級 / 間距 | 檔頭 `<style>`。顏色都是 CSS 變數（`--series-1` 等），改一處全站套用 |
| 上方卡片顯示的數字 | `renderSummary()` |
| 圖表長相 | `renderChart()`。折線 / 柱狀兩種畫法在同一個 `if (mode === "bar")` 分支裡 |
| 預設圖表形式 | `load()` 裡的 `s.chartMode === "bar" ? "bar" : "line"`（目前預設折線） |
| 清單每行文字 | `renderList()` |
| 新增紀錄的驗證邏輯 | `addReading()` |
| 推估的時間窗（30 天 → 60 天） | `renderSummary()` 裡的 `end - 30 * DAY` |
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
        state   { price, readings[] }
          ↓
      renderAll()
          ├── renderSummary()   → 上方卡片
          ├── renderChart()     → SVG 長條圖
          └── renderList()      → 下方清單
```

1. 改 `state` → 2. `save()` → 3. `renderAll()`（整個畫面重畫）

資料只有幾十筆，全部重畫是幾毫秒的事。刻意不用框架，換取「看得懂、改得動」。

**核心計算 `intervals()`** — 整個 App 的心臟。電表是累計值，`5539.1` 本身無意義；
有意義的是相鄰兩筆的差。它把 N 筆讀數轉成 N−1 段區間，每段算出 `days` / `used` / `perDay`。
卡片、每根柱子、清單每一行，全部從這個陣列長出來。

**`windowUsage()`** — 算「最近 30 天」時區間可能被界線切一半，它按比例分攤，
讓預估月費不會因為抄表間隔不規則而亂跳。

**`sw.js`** — 攔截所有檔案請求，策略是「先給快取的、背景偷抓新的」。
所以離線可用，代價是新版要開第二次才生效。

**資料儲存** — 全部在 `localStorage` 的單一 key `powerTracker.v1`，值是一串 JSON。
不上網、不同步。換手機要用「匯出 JSON」搬。
