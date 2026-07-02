# 天氣預報地圖網頁 - 實施計劃

## 1. 專案目錄結構

```
weather-map/
├── .github/
│   └── workflows/
│       ├── etl-weather-observation.yml    # 每小時氣象觀測
│       ├── etl-rainfall-observation.yml   # 每小時雨量觀測
│       ├── etl-weather-forecast.yml       # 每日天氣預報
│       ├── etl-weather-warning.yml        # 每30分鐘天氣警報
│       └── etl-typhoon.yml                # 每30分鐘颱風資訊
│
├── etl/                                   # Python ETL 腳本
│   ├── __init__.py
│   ├── config.py                          # 配置管理
│   ├── database.py                        # 資料庫連接
│   ├── utils.py                           # 工具函數
│   │
│   ├── weather_observation.py             # O-A0001-001 ETL
│   ├── rainfall_observation.py            # O-A0002-001 ETL
│   ├── weather_forecast.py                # F-D0047-093 ETL
│   ├── weather_warning.py                 # 天氣警報 ETL
│   └── typhoon.py                         # 颱風資訊 ETL
│
├── database/
│   ├── schema.sql                         # 完整 Schema
│   ├── migrations/                        # 遷移腳本
│   └── seed/                              # 初始數據
│
├── frontend/                              # Next.js 前端
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                   # 主頁面
│   │   │   └── api/                       # API Routes (如有需要)
│   │   ├── components/
│   │   │   ├── Map/
│   │   │   ├── WeatherCard/
│   │   │   ├── ForecastPanel/
│   │   │   └── WarningAlert/
│   │   ├── hooks/
│   │   ├── lib/
│   │   │   ├── supabase.ts               # Supabase Client
│   │   │   └── api.ts                     # API 調用
│   │   └── types/
│   ├── public/
│   ├── package.json
│   └── next.config.js
│
├── scripts/
│   ├── setup-db.sql                       # 資料庫初始化
│   └── test-api.py                        # API 測試腳本
│
├── .env.example                           # 環境變數範例
├── .gitignore
├── README.md
└── requirements.txt                       # Python 依賴
```

---

## 2. 資料庫 Schema (PostgreSQL + PostGIS)

### 2.1 基礎設定

```sql
-- 啟用 PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 創建 Schema
CREATE SCHEMA IF NOT EXISTS weather;

-- 設定時區
SET timezone = 'Asia/Taipei';
```

### 2.2 氣象觀測站 (O-A0001-001)

```sql
-- 氣象觀測站基本資訊
CREATE TABLE weather.stations (
    station_id VARCHAR(20) PRIMARY KEY,
    station_name VARCHAR(50) NOT NULL,
    county_name VARCHAR(20),
    county_code VARCHAR(10),
    town_name VARCHAR(20),
    town_code VARCHAR(10),
    altitude DECIMAL(10,2),
    location_wgs84 GEOGRAPHY(POINT, 4326),
    lat_wgs84 DECIMAL(10,6),
    lon_wgs84 DECIMAL(10,6),
    lat_twd67 DECIMAL(10,6),
    lon_twd67 DECIMAL(10,6),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 氣象觀測數據
CREATE TABLE weather.weather_observations (
    id BIGSERIAL PRIMARY KEY,
    station_id VARCHAR(20) REFERENCES weather.stations(station_id),
    observation_time TIMESTAMPTZ NOT NULL,
    weather VARCHAR(50),
    precipitation DECIMAL(10,2),
    wind_direction DECIMAL(10,2),
    wind_speed DECIMAL(10,2),
    air_temperature DECIMAL(10,2),
    relative_humidity DECIMAL(10,2),
    air_pressure DECIMAL(10,2),
    peak_gust_speed DECIMAL(10,2),
    gust_wind_direction DECIMAL(10,2),
    gust_occurred_at TIMESTAMPTZ,
    daily_high_temp DECIMAL(10,2),
    daily_high_at TIMESTAMPTZ,
    daily_low_temp DECIMAL(10,2),
    daily_low_at TIMESTAMPTZ,
    raw_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 唯一約束：同一觀測時間同一站只有一筆
CREATE UNIQUE INDEX idx_obs_unique 
ON weather.weather_observations(station_id, observation_time);

-- 索引
CREATE INDEX idx_obs_time ON weather.weather_observations(observation_time DESC);
CREATE INDEX idx_obs_station ON weather.weather_observations(station_id);
```

### 2.3 雨量觀測站 (O-A0002-001)

```sql
-- 雨量站基本資訊 (可與氣象站共用 stations 表，或獨立)
CREATE TABLE weather.rainfall_stations (
    station_id VARCHAR(20) PRIMARY KEY,
    station_name VARCHAR(50) NOT NULL,
    maintainer VARCHAR(50),
    county_name VARCHAR(20),
    county_code VARCHAR(10),
    town_name VARCHAR(20),
    town_code VARCHAR(10),
    altitude DECIMAL(10,2),
    location_wgs84 GEOGRAPHY(POINT, 4326),
    lat_wgs84 DECIMAL(10,6),
    lon_wgs84 DECIMAL(10,6),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 雨量觀測數據
CREATE TABLE weather.rainfall_observations (
    id BIGSERIAL PRIMARY KEY,
    station_id VARCHAR(20) REFERENCES weather.rainfall_stations(station_id),
    observation_time TIMESTAMPTZ NOT NULL,
    precipitation_now DECIMAL(10,2),
    precipitation_10min DECIMAL(10,2),
    precipitation_1hr DECIMAL(10,2),
    precipitation_3hr DECIMAL(10,2),
    precipitation_6hr DECIMAL(10,2),
    precipitation_12hr DECIMAL(10,2),
    precipitation_24hr DECIMAL(10,2),
    precipitation_2days DECIMAL(10,2),
    precipitation_3days DECIMAL(10,2),
    raw_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_rainfall_unique 
ON weather.rainfall_observations(station_id, observation_time);

CREATE INDEX idx_rainfall_time ON weather.rainfall_observations(observation_time DESC);
```

### 2.4 鄉鎮天氣預報 (F-D0047-093)

```sql
-- 鄉鎮天氣預報
CREATE TABLE weather.township_forecasts (
    id BIGSERIAL PRIMARY KEY,
    location_name VARCHAR(20) NOT NULL,
    location_code VARCHAR(10),
    district_name VARCHAR(20),
    district_code VARCHAR(10),
    forecast_time TIMESTAMPTZ NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    weather_element VARCHAR(50),
    value VARCHAR(100),
    measures VARCHAR(50),
    raw_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_forecast_location ON weather.township_forecasts(location_name, forecast_time DESC);
CREATE INDEX idx_forecast_time ON weather.township_forecasts(forecast_time DESC);
```

### 2.5 天氣警特報

```sql
-- 天氣警報
CREATE TABLE weather.weather_warnings (
    id BIGSERIAL PRIMARY KEY,
    warning_id VARCHAR(50) UNIQUE,
    warning_type VARCHAR(100),
    title VARCHAR(200),
    content TEXT,
    issue_time TIMESTAMPTZ,
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    affected_areas TEXT[],
    severity VARCHAR(20),
    status VARCHAR(20),
    raw_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_warning_type ON weather.weather_warnings(warning_type, issue_time DESC);
CREATE INDEX idx_warning_valid ON weather.weather_warnings(valid_from, valid_to);
```

### 2.6 颱風資訊

```sql
-- 颱風基本資訊
CREATE TABLE weather.typhoons (
    id BIGSERIAL PRIMARY KEY,
    typhoon_id VARCHAR(50) UNIQUE,
    typhoon_name VARCHAR(100),
    cwa_name VARCHAR(100),
    international_name VARCHAR(100),
    formed_at TIMESTAMPTZ,
    dissipated_at TIMESTAMPTZ,
    status VARCHAR(20),
    raw_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 颱風位置/路徑
CREATE TABLE weather.typhoon_positions (
    id BIGSERIAL PRIMARY KEY,
    typhoon_id VARCHAR(50) REFERENCES weather.typhoons(typhoon_id),
    observation_time TIMESTAMPTZ NOT NULL,
    lat DECIMAL(10,4),
    lon DECIMAL(10,4),
    location GEOGRAPHY(POINT, 4326),
    max_wind_speed DECIMAL(10,2),
    max_gust_speed DECIMAL(10,2),
    pressure DECIMAL(10,2),
    moving_speed DECIMAL(10,2),
    moving_direction VARCHAR(50),
    radius_70kph DECIMAL(10,2),
    radius_50kph DECIMAL(10,2),
    radius_30kph DECIMAL(10,2),
    raw_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_typhoon_position ON weather.typhoon_positions(typhoon_id, observation_time DESC);
```

### 2.7 ETL 執行記錄

```sql
-- ETL 執行日誌
CREATE TABLE weather.etl_logs (
    id BIGSERIAL PRIMARY KEY,
    job_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    records_processed INTEGER DEFAULT 0,
    records_inserted INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_etl_job ON weather.etl_logs(job_name, started_at DESC);
```

---

## 3. ETL 流程設計

### 3.1 通用 ETL 架構

```python
# etl/base.py
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional
import httpx
from supabase import create_client

class BaseETL(ABC):
    def __init__(self):
        self.api_base = "https://opendata.cwa.gov.tw/api/v1/rest/datastore"
        self.api_token = os.getenv("CWA_API_TOKEN")
        self.supabase = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_KEY")
        )
    
    async def fetch_data(self, dataset_id: str, params: dict = None) -> dict:
        """從 CWA API 獲取數據"""
        url = f"{self.api_base}/{dataset_id}"
        headers = {"Authorization": self.api_token}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params)
            response.raise_for_status()
            return response.json()
    
    def parse_value(self, value: str) -> Optional[float]:
        """解析數值，-99 轉為 None"""
        if value is None or value == "-99":
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    def parse_datetime(self, dt_str: str) -> Optional[datetime]:
        """解析 ISO 8601 時間"""
        if dt_str is None or dt_str == "-99":
            return None
        try:
            return datetime.fromisoformat(dt_str)
        except (ValueError, TypeError):
            return None
    
    @abstractmethod
    async def extract(self) -> dict:
        """提取數據"""
        pass
    
    @abstractmethod
    async def transform(self, raw_data: dict) -> list:
        """轉換數據"""
        pass
    
    @abstractmethod
    async def load(self, records: list) -> dict:
        """載入數據"""
        pass
    
    async def run(self):
        """執行完整 ETL 流程"""
        start_time = datetime.now()
        job_name = self.__class__.__name__
        
        try:
            # Extract
            raw_data = await self.extract()
            
            # Transform
            records = await self.transform(raw_data)
            
            # Load
            result = await self.load(records)
            
            # Log success
            await self.log_etl(job_name, "success", start_time, result)
            
            return result
            
        except Exception as e:
            await self.log_etl(job_name, "failed", start_time, error=str(e))
            raise
    
    async def log_etl(self, job_name, status, started_at, result=None, error=None):
        """記錄 ETL 執行"""
        log_data = {
            "job_name": job_name,
            "status": status,
            "started_at": started_at.isoformat(),
            "completed_at": datetime.now().isoformat(),
            "records_processed": result.get("processed", 0) if result else 0,
            "records_inserted": result.get("inserted", 0) if result else 0,
            "records_updated": result.get("updated", 0) if result else 0,
            "error_message": error
        }
        self.supabase.table("etl_logs").insert(log_data).execute()
```

### 3.2 氣象觀測 ETL 範例

```python
# etl/weather_observation.py
from .base import BaseETL

class WeatherObservationETL(BaseETL):
    DATASET_ID = "O-A0001-001"
    
    async def extract(self):
        return await self.fetch_data(self.DATASET_ID)
    
    async def transform(self, raw_data):
        records = []
        stations = raw_data.get("records", {}).get("Station", [])
        
        for station in stations:
            geo_info = station.get("GeoInfo", {})
            weather_elem = station.get("WeatherElement", {})
            gust_info = weather_elem.get("GustInfo", {})
            daily_extreme = weather_elem.get("DailyExtreme", {})
            
            # 取得 WGS84 座標
            wgs84 = next(
                (c for c in geo_info.get("Coordinates", []) 
                 if c.get("CoordinateName") == "WGS84"),
                {}
            )
            
            record = {
                "station_id": station.get("StationId"),
                "observation_time": station.get("ObsTime", {}).get("DateTime"),
                "weather": weather_elem.get("Weather"),
                "precipitation": self.parse_value(
                    weather_elem.get("Now", {}).get("Precipitation")
                ),
                "wind_direction": self.parse_value(weather_elem.get("WindDirection")),
                "wind_speed": self.parse_value(weather_elem.get("WindSpeed")),
                "air_temperature": self.parse_value(weather_elem.get("AirTemperature")),
                "relative_humidity": self.parse_value(weather_elem.get("RelativeHumidity")),
                "air_pressure": self.parse_value(weather_elem.get("AirPressure")),
                "peak_gust_speed": self.parse_value(gust_info.get("PeakGustSpeed")),
                "raw_json": station
            }
            records.append(record)
        
        return records
    
    async def load(self, records):
        inserted = 0
        updated = 0
        
        for record in records:
            # 使用 upsert 避免重複
            result = self.supabase.table("weather_observations") \
                .upsert(record, on_conflict="station_id,observation_time") \
                .execute()
            
            if result.data:
                inserted += 1
        
        return {"processed": len(records), "inserted": inserted, "updated": updated}
```

---

## 4. GitHub Actions 工作流程

### 4.1 每小時氣象觀測 (O-A0001-001)

```yaml
# .github/workflows/etl-weather-observation.yml
name: ETL - Weather Observation (Hourly)

on:
  schedule:
    - cron: '5 * * * *'  # 每小時第5分鐘執行
  workflow_dispatch:  # 允許手動觸發

jobs:
  fetch-weather-observation:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
      
      - name: Install dependencies
        run: pip install -r requirements.txt
      
      - name: Run ETL
        env:
          CWA_API_TOKEN: ${{ secrets.CWA_API_TOKEN }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
        run: python -m etl.weather_observation
```

### 4.2 每小時雨量觀測 (O-A0002-001)

```yaml
# .github/workflows/etl-rainfall-observation.yml
name: ETL - Rainfall Observation (Hourly)

on:
  schedule:
    - cron: '10 * * * *'  # 每小時第10分鐘執行
  workflow_dispatch:

jobs:
  fetch-rainfall-observation:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
      
      - run: pip install -r requirements.txt
      
      - name: Run ETL
        env:
          CWA_API_TOKEN: ${{ secrets.CWA_API_TOKEN }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
        run: python -m etl.rainfall_observation
```

### 4.3 每30分鐘天氣警報

```yaml
# .github/workflows/etl-weather-warning.yml
name: ETL - Weather Warning (Every 30 min)

on:
  schedule:
    - cron: '*/30 * * * *'  # 每30分鐘執行
  workflow_dispatch:

jobs:
  fetch-weather-warning:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
      
      - run: pip install -r requirements.txt
      
      - name: Run ETL
        env:
          CWA_API_TOKEN: ${{ secrets.CWA_API_TOKEN }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
        run: python -m etl.weather_warning
```

---

## 5. 前端架構 (Next.js + Supabase)

### 5.1 Supabase Client

```typescript
// frontend/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### 5.2 資料獲取 Hooks

```typescript
// frontend/src/hooks/useWeatherData.ts
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useLatestObservations() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('weather_observations')
        .select(`
          *,
          stations:station_id (
            station_name,
            county_name,
            location_wgs84
          )
        `)
        .order('observation_time', { ascending: false })
        .limit(100)

      if (!error) setData(data)
      setLoading(false)
    }

    fetchData()

    // 訂閱即時更新
    const subscription = supabase
      .channel('weather_observations')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'weather', table: 'weather_observations' },
        (payload) => {
          setData(prev => [payload.new, ...prev.slice(0, 99)])
        }
      )
      .subscribe()

    return () => { subscription.unsubscribe() }
  }, [])

  return { data, loading }
}
```

### 5.3 地圖組件

```typescript
// frontend/src/components/Map/WeatherMap.tsx
'use client'

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

export default function WeatherMap({ stations }) {
  return (
    <MapContainer
      center={[23.5, 121]}
      zoom={8}
      style={{ height: '100vh', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      
      {stations.map(station => (
        <Marker
          key={station.station_id}
          position={[station.lat_wgs84, station.lon_wgs84]}
        >
          <Popup>
            <div>
              <h3>{station.station_name}</h3>
              <p>氣溫: {station.air_temperature}°C</p>
              <p>降雨: {station.precipitation}mm</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
```

---

## 6. 環境變數設定

```bash
# .env.example

# CWA OpenData API
CWA_API_TOKEN=your_cwa_api_token_here

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# Frontend (Next.js)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 7. 實施步驟 (按順序執行)

### Phase 1: 基礎建設 (1-2天)

- [ ] **Step 1**: 申請帳號與取得 API
  - 註冊 CWA OpenData 帳號，取得 API Token
  - 建立 Supabase 專案，取得連接資訊
  - 建立 GitHub Repository

- [ ] **Step 2**: 初始化專案結構
  - 建立目錄結構
  - 設定 `.gitignore`、`.env.example`
  - 建立 `requirements.txt`

- [ ] **Step 3**: 設定 Supabase 資料庫
  - 執行 `schema.sql` 建立所有資料表
  - 啟用 PostGIS extension
  - 設定 Row Level Security (RLS)

### Phase 2: ETL 開發 (2-3天)

- [ ] **Step 4**: 開發基礎 ETL 模組
  - 建立 `etl/base.py` 通用類別
  - 建立 `etl/config.py` 配置管理
  - 建立 `etl/database.py` 資料庫連接

- [ ] **Step 5**: 開發各數據集 ETL
  - `weather_observation.py` (O-A0001-001)
  - `rainfall_observation.py` (O-A0002-001)
  - `weather_forecast.py` (F-D0047-093)
  - `weather_warning.py`
  - `typhoon.py`

- [ ] **Step 6**: 本地測試 ETL
  - 使用 `scripts/test-api.py` 測試 API 連接
  - 驗證數據正確寫入 Supabase

### Phase 3: GitHub Actions (1天)

- [ ] **Step 7**: 設定 GitHub Secrets
  - `CWA_API_TOKEN`
  - `SUPABASE_URL`
  - `SUPABASE_KEY`

- [ ] **Step 8**: 建立工作流程檔案
  - 建立所有 `.yml` 工作流程
  - 測試手動觸發

### Phase 4: 前端開發 (3-5天)

- [ ] **Step 9**: 初始化 Next.js 專案
  - 建立 Next.js 應用
  - 安裝 Supabase、Leaflet 依賴
  - 設定環境變數

- [ ] **Step 10**: 開發地圖組件
  - 整合 Leaflet 地圖
  - 顯示觀測站點
  - 顯示即時氣象數據

- [ ] **Step 11**: 開發數據面板
  - 天氣預報顯示
  - 警報資訊顯示
  - 颱風路徑圖

- [ ] **Step 12**: 部署到 Vercel
  - 連接 GitHub Repository
  - 設定環境變數
  - 測試部署

### Phase 5: 測試與優化 (1-2天)

- [ ] **Step 13**: 端到端測試
  - 驗證 ETL 正常執行
  - 驗證前端正確顯示
  - 修復 Bug

- [ ] **Step 14**: 文件與優化
  - 更新 README
  - 優化查詢效能
  - 設定監控告警

---

## 8. 注意事項

### 數據處理
- **`-99` 值**: CWA API 使用 `-99` 表示無數據，ETL 需轉換為 `NULL`
- **時區**: 所有時間都是 `+08:00` (台灣時間)
- **重複數據**: 使用 `upsert` 避免重複插入

### 安全性
- **API Token**: 絕對不要暴露在前端代碼中
- **Supabase RLS**: 建議設定唯讀權限給前端
- **環境變數**: 使用 GitHub Secrets 存儲敏感資訊

### 效能
- **索引**: 確保常用查詢欄位有索引
- **分頁**: 大量數據使用分頁查詢
- **快取**: 前端可適當使用快取減少請求

---

## 9. 後續擴展 (Phase 2)

完成 Prototype 後，可考慮：

1. **今明 36 小時預報** (F-C0032-001)
2. **歷史氣候資料** - 長期分析
3. **AI 分析服務** - 天氣預測模型
4. **推播通知** - 警報即時通知
5. **行動應用** - React Native 版本
