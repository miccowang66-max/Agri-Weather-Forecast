"""
CWA O-A0001-001 自動氣象站觀測資料下載腳本
Usage: python fetch_weather.py [API_TOKEN]
"""

import json
import sys
import os
from datetime import datetime
from pathlib import Path

try:
    import httpx
except ImportError:
    print("請先安裝 httpx: pip install httpx")
    sys.exit(1)


API_BASE = "https://opendata.cwa.gov.tw/api/v1/rest/datastore"
DATASET_ID = "O-A0001-001"


def fetch_weather_data(api_token: str) -> dict:
    """從 CWA API 獲取氣象觀測數據"""
    url = f"{API_BASE}/{DATASET_ID}"
    params = {"format": "JSON"}
    headers = {"Authorization": api_token}

    print(f"正在請求 {url} ...")
    
    with httpx.Client(timeout=30) as client:
        response = client.get(url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()


def parse_value(value: str) -> float | None:
    """解析數值，-99 轉為 None"""
    if value is None or value == "-99":
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def transform_data(raw_data: dict) -> list[dict]:
    """轉換 API 數據為前端可用格式"""
    stations = []
    raw_stations = raw_data.get("records", {}).get("Station", [])

    for station in raw_stations:
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

        transformed = {
            "id": station.get("StationId"),
            "name": station.get("StationName"),
            "county": geo_info.get("CountyName"),
            "town": geo_info.get("TownName"),
            "lat": parse_value(wgs84.get("StationLatitude")),
            "lon": parse_value(wgs84.get("StationLongitude")),
            "altitude": parse_value(geo_info.get("StationAltitude")),
            "time": station.get("ObsTime", {}).get("DateTime"),
            "weather": weather_elem.get("Weather"),
            "temp": parse_value(weather_elem.get("AirTemperature")),
            "humidity": parse_value(weather_elem.get("RelativeHumidity")),
            "pressure": parse_value(weather_elem.get("AirPressure")),
            "wind_speed": parse_value(weather_elem.get("WindSpeed")),
            "wind_dir": parse_value(weather_elem.get("WindDirection")),
            "precipitation": parse_value(
                weather_elem.get("Now", {}).get("Precipitation")
            ),
            "gust_speed": parse_value(gust_info.get("PeakGustSpeed")),
        }
        
        # 過濾掉沒有座標的站點
        if transformed["lat"] and transformed["lon"]:
            stations.append(transformed)

    return stations


def save_data(stations: list[dict], output_dir: str = "."):
    """保存數據到 JSON 文件"""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # 保存觀測數據
    data_file = output_path / "weather_observation.json"
    with open(data_file, "w", encoding="utf-8") as f:
        json.dump({
            "updated_at": datetime.now().isoformat(),
            "count": len(stations),
            "stations": stations
        }, f, ensure_ascii=False, indent=2)

    print(f"已保存 {len(stations)} 個站點數據到 {data_file}")
    return data_file


def main():
    # 從命令行參數或環境變數獲取 API Token
    api_token = None
    if len(sys.argv) > 1:
        api_token = sys.argv[1]
    else:
        api_token = os.environ.get("CWA_API_TOKEN")

    if not api_token:
        print("錯誤: 請提供 API Token")
        print("用法: python fetch_weather.py YOUR_API_TOKEN")
        print("或設定環境變數: set CWA_API_TOKEN=YOUR_API_TOKEN")
        sys.exit(1)

    try:
        # 下載數據
        raw_data = fetch_weather_data(api_token)
        
        if raw_data.get("success") != "true":
            print(f"API 返回錯誤: {raw_data}")
            sys.exit(1)

        # 轉換數據
        stations = transform_data(raw_data)
        print(f"成功解析 {len(stations)} 個站點")

        # 保存到 data 目錄
        save_data(stations, "data")

        # 顯示前 5 個站點作為預覽
        print("\n前 5 個站點預覽:")
        for s in stations[:5]:
            print(f"  {s['name']} ({s['county']}): {s['temp']}°C, 風速 {s['wind_speed']} m/s")

    except httpx.HTTPStatusError as e:
        print(f"HTTP 錯誤: {e.response.status_code}")
        print(f"回應內容: {e.response.text}")
        sys.exit(1)
    except Exception as e:
        print(f"錯誤: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
