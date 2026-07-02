"""
CWA O-A0001-001 ETL: 自動氣象站觀測資料
Fetch from CWA API → Store in Supabase
"""

import os
import sys
from datetime import datetime
from typing import Optional

import httpx
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

CWA_API_BASE = "https://opendata.cwa.gov.tw/api/v1/rest/datastore"
DATASET_ID = "O-A0001-001"


def get_clients():
    """Initialize CWA and Supabase clients"""
    cwa_token = os.getenv("CWA_API_TOKEN")
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")

    if not all([cwa_token, supabase_url, supabase_key]):
        print("Error: Missing environment variables. Check .env file.")
        sys.exit(1)

    supabase = create_client(supabase_url, supabase_key)
    return cwa_token, supabase


def fetch_cwa_data(api_token: str) -> dict:
    """Fetch weather observation data from CWA API"""
    url = f"{CWA_API_BASE}/{DATASET_ID}"
    params = {"format": "JSON"}
    headers = {"Authorization": api_token}

    print(f"Fetching from CWA API: {DATASET_ID}")

    with httpx.Client(timeout=30, verify=False) as client:
        response = client.get(url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()


def parse_value(value: str) -> Optional[float]:
    """Parse numeric value, convert -99 to None"""
    if value is None or value == "-99":
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def parse_datetime(dt_str: str) -> Optional[str]:
    """Parse ISO 8601 datetime string"""
    if dt_str is None or dt_str == "-99":
        return None
    return dt_str


def transform(raw_data: dict) -> tuple[list[dict], list[dict]]:
    """Transform CWA API response into stations and observations"""
    stations = []
    observations = []
    raw_stations = raw_data.get("records", {}).get("Station", [])

    for station in raw_stations:
        geo_info = station.get("GeoInfo", {})
        weather_elem = station.get("WeatherElement", {})
        obs_time = station.get("ObsTime", {}).get("DateTime")

        # Get WGS84 coordinates
        wgs84 = next(
            (c for c in geo_info.get("Coordinates", [])
             if c.get("CoordinateName") == "WGS84"),
            {}
        )

        lat = parse_value(wgs84.get("StationLatitude"))
        lon = parse_value(wgs84.get("StationLongitude"))

        # Skip stations without coordinates
        if lat is None or lon is None:
            continue

        station_id = station.get("StationId")

        # Station record
        stations.append({
            "station_id": station_id,
            "station_name": station.get("StationName"),
            "county_name": geo_info.get("CountyName"),
            "town_name": geo_info.get("TownName"),
            "latitude": lat,
            "longitude": lon,
            "altitude": parse_value(geo_info.get("StationAltitude")),
        })

        # Observation record
        observations.append({
            "station_id": station_id,
            "observation_time": obs_time,
            "weather": weather_elem.get("Weather"),
            "air_temperature": parse_value(weather_elem.get("AirTemperature")),
            "relative_humidity": parse_value(weather_elem.get("RelativeHumidity")),
            "air_pressure": parse_value(weather_elem.get("AirPressure")),
            "wind_speed": parse_value(weather_elem.get("WindSpeed")),
            "wind_direction": parse_value(weather_elem.get("WindDirection")),
            "precipitation": parse_value(
                weather_elem.get("Now", {}).get("Precipitation")
            ),
            "raw_json": station,
        })

    return stations, observations


def load_to_supabase(supabase, stations: list[dict], observations: list[dict]):
    """Load data into Supabase using upsert"""
    print(f"Loading {len(stations)} stations...")
    supabase.table("weather_stations").upsert(
        stations, on_conflict="station_id"
    ).execute()

    print(f"Loading {len(observations)} observations...")
    supabase.table("weather_observations").upsert(
        observations, on_conflict="station_id,observation_time"
    ).execute()


def log_etl(supabase, job_name: str, status: str, started_at: datetime,
            records: int, error: str = None):
    """Log ETL execution"""
    supabase.table("etl_logs").insert({
        "job_name": job_name,
        "status": status,
        "started_at": started_at.isoformat(),
        "completed_at": datetime.now().isoformat(),
        "records_processed": records,
        "error_message": error,
    }).execute()


def main():
    started_at = datetime.now()
    job_name = f"etl_{DATASET_ID}"

    try:
        # Initialize clients
        cwa_token, supabase = get_clients()

        # Extract
        raw_data = fetch_cwa_data(cwa_token)

        if raw_data.get("success") != "true":
            raise Exception(f"CWA API error: {raw_data}")

        # Transform
        stations, observations = transform(raw_data)
        print(f"Transformed: {len(stations)} stations, {len(observations)} observations")

        # Load
        load_to_supabase(supabase, stations, observations)

        # Log success
        log_etl(supabase, job_name, "success", started_at, len(observations))
        print("ETL completed successfully!")

        # Preview
        print("\nPreview (first 5 stations):")
        for s in stations[:5]:
            print(f"  {s['station_name']} ({s['county_name']})")

    except Exception as e:
        print(f"ETL failed: {e}")
        try:
            log_etl(supabase, job_name, "failed", started_at, 0, str(e))
        except:
            pass
        sys.exit(1)


if __name__ == "__main__":
    main()
