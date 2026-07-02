# Weather Map - 台灣天氣觀測地圖

即時氣象觀測數據視覺化地圖

## 架構

```text
CWA OpenData API
       │
       ▼
Python ETL (fetch_weather_observation.py)
       │
       ▼
Supabase PostgreSQL
       │
       ▼
Next.js + Windy Map (前端)
```

- **CWA API**: 官方氣象數據來源
- **ETL**: Python 腳本定期抓取並存儲數據
- **Supabase**: PostgreSQL 資料庫
- **Windy Map**: 前端地圖視覺化

## 快速開始

### 1. 設定 Supabase

1. 建立 Supabase 專案
2. 在 SQL Editor 執行 `database/schema.sql`

### 2. 設定 ETL

```bash
cd etl
cp .env.example .env
# 編輯 .env 填入你的 API Token 和 Supabase 資訊
pip install -r requirements.txt
python fetch_weather_observation.py
```

### 3. 啟動前端

```bash
cd frontend
cp .env.local.example .env.local
# 編輯 .env.local 填入 Supabase 和 Windy API 資訊
npm install
npm run dev
```

### 4. 部署

**Frontend (Vercel)**:
- 連接 GitHub repo
- 設定環境變數

**ETL (GitHub Actions)**:
- 設定 Secrets: `CWA_API_TOKEN`, `SUPABASE_URL`, `SUPABASE_KEY`

## 環境變數

### ETL (.env)
- `CWA_API_TOKEN`: CWA OpenData API Token
- `SUPABASE_URL`: Supabase 專案 URL
- `SUPABASE_KEY`: Supabase Anon Key

### Frontend (.env.local)
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 專案 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Anon Key
- `NEXT_PUBLIC_WINDY_API_KEY`: Windy API Key

## 資料庫 Schema

- `weather_stations`: 氣象站基本資訊
- `weather_observations`: 觀測數據
- `etl_logs`: ETL 執行記錄
