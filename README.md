# Weather Map - 台灣天氣觀測地圖

即時氣象觀測數據視覺化地圖

## Live Demo

🔗 [Weather Map Demo](https://agri-weather-forecast.vercel.app)

## 架構

```text
CWA OpenData API ──► Python ETL ──► Supabase PostgreSQL
                                          │
                                          ▼
                                   Next.js Frontend
                                          │
                                          ▼
                                   Windy Map (視覺化)
```

- **CWA API**: 官方氣象數據來源 (每小時更新)
- **ETL**: Python 腳本抓取並存儲數據
- **Supabase**: PostgreSQL 資料庫
- **Windy Map**: 前端地圖視覺化

## 快速開始

### 1. Supabase 設定

1. 建立 Supabase 專案
2. 在 SQL Editor 執行 `database/schema.sql`
3. 設定 RLS policy (見下方)

### 2. ETL 設定

```bash
cd etl
cp .env.example .env
# 編輯 .env 填入你的 API Token
pip install -r requirements.txt
python fetch_weather_observation.py
```

### 3. 前端部署 (Vercel)

1. Fork 此 repo
2. 在 Vercel 匯入專案
3. 設定環境變數：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_WINDY_API_KEY`

### 4. 自動 ETL (GitHub Actions)

在 GitHub repo Settings > Secrets 添加：
- `CWA_API_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_KEY`

## 環境變數

| 變數 | 用途 | 位置 |
|------|------|------|
| `CWA_API_TOKEN` | CWA API Token | ETL .env / GitHub Secrets |
| `SUPABASE_URL` | Supabase API URL | ETL .env / GitHub Secrets |
| `SUPABASE_KEY` | Supabase Anon Key | ETL .env / GitHub Secrets |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL | Frontend .env.local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key | Frontend .env.local |
| `NEXT_PUBLIC_WINDY_API_KEY` | Windy API Key | Frontend .env.local |

## 資料庫 Schema

- `weather_stations`: 氣象站基本資訊
- `weather_observations`: 觀測數據
- `etl_logs`: ETL 執行記錄

## RLS Policy

```sql
-- 允許讀取
CREATE POLICY "Allow public read" ON weather_stations FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON weather_observations FOR SELECT USING (true);

-- 允許寫入 (ETL)
CREATE POLICY "Allow public insert" ON weather_stations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public upsert" ON weather_stations FOR UPDATE USING (true);
CREATE POLICY "Allow public insert" ON weather_observations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public upsert" ON weather_observations FOR UPDATE USING (true);

-- etl_logs 關閉 RLS
ALTER TABLE etl_logs DISABLE ROW LEVEL SECURITY;
```

## 技術棧

- **Frontend**: Next.js 14 + TypeScript
- **地圖**: Windy Map Forecast API (基於 Leaflet)
- **資料庫**: Supabase (PostgreSQL)
- **ETL**: Python + httpx + supabase-py
- **部署**: Vercel (前端) + GitHub Actions (ETL)
