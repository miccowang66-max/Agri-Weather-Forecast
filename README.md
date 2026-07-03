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
                              Windy Map (地圖渲染) + 自訂標記
```

- **CWA API**: 官方氣象數據來源 (每小時更新)
- **ETL**: Python 腳本抓取並存儲數據 (GitHub Actions 每小時排程)
- **Supabase**: PostgreSQL 資料庫
- **Windy Map**: 前端地圖底層渲染
- **Leaflet Markers**: 自有觀測資料疊加標記

## 功能說明

- **時間軸**: 過去 7 天日期選擇，每天固定 12:00 觀測時間點
- **地圖標記**: 彩色圓點顯示各氣象站溫度 (依溫度與降雨著色)
- **統計面板**: 當前選擇時間的站點數量、平均/最高/最低氣溫
- **點擊彈窗**: 點擊標記查看完整觀測數據 (天氣、濕度、風速、降雨、氣壓)

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
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL | Frontend .env.local / Vercel |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key | Frontend .env.local / Vercel |
| `NEXT_PUBLIC_WINDY_API_KEY` | Windy API Key | Frontend .env.local / Vercel |

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

## RPC Function

在 Supabase SQL Editor 執行以加速 Timeline 日期查詢 (選用)：

```sql
CREATE OR REPLACE FUNCTION get_distinct_observation_times(
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ
)
RETURNS TABLE(obs_time TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT DISTINCT date_trunc('hour', observation_time) AS obs_time
  FROM weather_observations
  WHERE observation_time >= start_time
    AND observation_time <= end_time
  ORDER BY obs_time;
$$;
```

## 技術棧

- **Frontend**: Next.js 14 + TypeScript
- **地圖**: Windy Map Forecast API (底圖) + Leaflet (自訂標記)
- **資料庫**: Supabase (PostgreSQL)
- **ETL**: Python + httpx + supabase-py
- **部署**: Vercel (前端) + GitHub Actions (ETL)
