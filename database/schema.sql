-- Supabase Schema for Weather Map Prototype
-- Execute this in Supabase SQL Editor

-- Enable PostGIS (optional, for future GIS queries)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. 氣象觀測站基本資訊
CREATE TABLE IF NOT EXISTS weather_stations (
    station_id VARCHAR(20) PRIMARY KEY,
    station_name VARCHAR(50) NOT NULL,
    county_name VARCHAR(20),
    town_name VARCHAR(20),
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    altitude DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 氣象觀測數據
CREATE TABLE IF NOT EXISTS weather_observations (
    id BIGSERIAL PRIMARY KEY,
    station_id VARCHAR(20) REFERENCES weather_stations(station_id),
    observation_time TIMESTAMPTZ NOT NULL,
    weather VARCHAR(50),
    air_temperature DECIMAL(10,2),
    relative_humidity DECIMAL(10,2),
    air_pressure DECIMAL(10,2),
    wind_speed DECIMAL(10,2),
    wind_direction DECIMAL(10,2),
    precipitation DECIMAL(10,2),
    raw_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 唯一約束：同一觀測時間同一站只有一筆
CREATE UNIQUE INDEX IF NOT EXISTS idx_obs_unique 
ON weather_observations(station_id, observation_time);

-- 索引
CREATE INDEX IF NOT EXISTS idx_obs_time ON weather_observations(observation_time DESC);
CREATE INDEX IF NOT EXISTS idx_obs_station ON weather_observations(station_id);

-- 3. ETL 執行記錄
CREATE TABLE IF NOT EXISTS etl_logs (
    id BIGSERIAL PRIMARY KEY,
    job_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    records_processed INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policy (允許匿名讀取，用於前端)
ALTER TABLE weather_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON weather_stations
    FOR SELECT USING (true);

CREATE POLICY "Allow public read" ON weather_observations
    FOR SELECT USING (true);
