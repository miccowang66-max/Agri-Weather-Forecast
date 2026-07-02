# Weather Map Prototype

天氣預報地圖網頁 - 最小原型

## 快速開始

### 1. 安裝 Python 依賴

```bash
pip install httpx
```

### 2. 下載氣象數據

```bash
python prototype/fetch_weather.py YOUR_CWA_API_TOKEN
```

或設定環境變數：

```bash
set CWA_API_TOKEN=YOUR_CWA_API_TOKEN
python prototype/fetch_weather.py
```

### 3. 啟動本地網頁

直接用瀏覽器打開 `prototype/index.html`

或使用簡單的 HTTP 伺服器：

```bash
cd prototype
python -m http.server 8000
```

然後訪問 http://localhost:8000

## 結構

```
prototype/
├── index.html          # 主頁面
├── fetch_weather.py    # 數據下載腳本
└── data/               # 數據目錄 (自動生成)
    └── weather_observation.json
```

## 部署到 GitHub Pages

1. 推送代碼到 GitHub
2. 在 repo Settings > Pages 啟用
3. 選擇 `prototype/` 目錄作為 source
