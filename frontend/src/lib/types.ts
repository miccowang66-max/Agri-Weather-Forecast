export interface WeatherStation {
  station_id: string
  station_name: string
  county_name: string
  town_name: string
  latitude: number
  longitude: number
  altitude: number | null
}

export interface WeatherObservation {
  id: number
  station_id: string
  observation_time: string
  weather: string | null
  air_temperature: number | null
  relative_humidity: number | null
  air_pressure: number | null
  wind_speed: number | null
  wind_direction: number | null
  precipitation: number | null
  created_at: string
}

export interface StationWithObservation extends WeatherStation {
  latest_observation: WeatherObservation | null
}
