# ⚡ 電費追蹤

一個記錄電表度數、看用電趨勢與預估電費的小工具。純前端 PWA，加到 iPhone 主畫面後就跟 App 一樣。

## 功能

- 輸入「日期 + 電表累計度數」，自動算出區間用電、每日平均、電費
- **預估月費**：以最近 30 天的實際用量推估，並和前 30 天比較漲跌
- 每日平均用電趨勢圖，可切換**折線 / 柱狀**（點一下看該期詳情），含全期平均參考線
- 電價可調（預設 6 元/度）
- 匯出 / 匯入 JSON 備份，匯出 CSV
- 深淺色模式、離線可用
- 換表或輸入錯誤（度數變低）會標記出來，且不會污染統計

## 檔案

| 檔案 | 用途 |
|---|---|
| `index.html` | 整個 App（HTML + CSS + JS，無外部相依） |
| `sw.js` | Service worker，負責離線快取 |
| `manifest.webmanifest` | PWA 設定（名稱、圖示、standalone 顯示） |
| `icon-180/192/512.png` | App 圖示 |
| `make_icons.py` | 重新產生圖示（純標準函式庫，無需 pip install） |

## 裝到 iPhone

PWA 需要用 **https 網址**（或 localhost）才能加到主畫面並離線運作，直接用 Files App 開 `index.html` 是不行的。所以要先把這個資料夾丟到任何靜態網頁空間，例如 GitHub Pages：

```bash
cd ~/power-tracker && git init && git add . && git commit -m "電費追蹤"
```

接著在 GitHub 建一個 repo，然後：

```bash
git remote add origin https://github.com/<你的帳號>/power-tracker.git && git branch -M main && git push -u origin main
```

到 repo 的 **Settings → Pages → Source: Deploy from a branch → main / (root)**，等一兩分鐘就會有網址：
`https://<你的帳號>.github.io/power-tracker/`

然後在 iPhone 上：

1. 用 **Safari**（一定要 Safari，Chrome 不行）打開那個網址
2. 點下方的分享鈕 → **加入主畫面**
3. 主畫面就會出現「電費」圖示，點開是全螢幕、沒有網址列，離線也能用

## 本機預覽

```bash
python3 -m http.server 8731 --directory ~/power-tracker
```

開 http://localhost:8731

## 注意事項

- **資料只存在該裝置的瀏覽器裡**（localStorage）。手機和電腦不會同步。清除 Safari 網站資料會一併刪除，建議偶爾用「設定與資料 → 匯出 JSON」備份。
- 改了 `index.html` 之後，因為 service worker 是快取優先，第一次開還是舊版、**重新整理第二次**才會看到新版。要強制更新可以把 `sw.js` 裡的 `CACHE` 版本號加一。
- 「預估月費」是用最近 30 天的實際用量 × 30 天 × 電價推估，不含基本費或其他分攤費用。
