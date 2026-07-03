'use client'

import { useEffect, useRef } from 'react'
import { StationWithObservation } from '@/lib/types'

interface WindyMapProps {
  stations: StationWithObservation[]
  center?: [number, number]
  zoom?: number
}

declare global {
  interface Window {
    windyInit: (options: any, callback: (windyAPI: any) => void) => void
    L: any
  }
}

export default function WindyMap({ 
  stations, 
  center = [23.7, 121], 
  zoom = 8
}: WindyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const windyAPIRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)
  const stationsRef = useRef<StationWithObservation[]>(stations)
  const mapReadyRef = useRef(false)

  stationsRef.current = stations

  useEffect(() => {
    if (!mapRef.current || windyAPIRef.current) return

    const leafletCss = document.createElement('link')
    leafletCss.rel = 'stylesheet'
    leafletCss.href = 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.css'
    document.head.appendChild(leafletCss)

    const leafletScript = document.createElement('script')
    leafletScript.src = 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.js'
    leafletScript.onload = () => {
      const windyScript = document.createElement('script')
      windyScript.src = 'https://api.windy.com/assets/map-forecast/libBoot.js'
      windyScript.onload = () => {
        initWindyMap()
      }
      document.head.appendChild(windyScript)
    }
    document.head.appendChild(leafletScript)

    return () => {
      if (windyAPIRef.current?.map) {
        windyAPIRef.current.map.remove()
        windyAPIRef.current = null
      }
      mapReadyRef.current = false
    }
  }, [])

  useEffect(() => {
    if (mapReadyRef.current && stations.length > 0) {
      addMarkers(stations)
    } else if (mapReadyRef.current && stations.length === 0) {
      markersLayerRef.current?.clearLayers()
    }
  }, [stations])

  function initWindyMap() {
    const options = {
      key: process.env.NEXT_PUBLIC_WINDY_API_KEY || '',
      verbose: false,
      lat: center[0],
      lon: center[1],
      zoom: zoom,
    }

    window.windyInit(options, (windyAPI: any) => {
      windyAPIRef.current = windyAPI
      const { map } = windyAPI

      const L = window.L
      const markersLayer = L.layerGroup().addTo(map)
      markersLayerRef.current = markersLayer
      mapReadyRef.current = true

      const currentStations = stationsRef.current
      if (currentStations.length > 0) {
        addMarkers(currentStations)
      }
    })
  }

  function addMarkers(stationsData: StationWithObservation[]) {
    const L = window.L
    if (!markersLayerRef.current) return

    markersLayerRef.current.clearLayers()

    stationsData.forEach((station) => {
      if (!station.latitude || !station.longitude) return

      const obs = station.latest_observation
      const color = getMarkerColor(obs)
      const temp = obs ? formatTemp(obs.air_temperature) : '-'

      const icon = L.divIcon({
        className: 'weather-marker',
        html: `<div style="
          background: ${color};
          color: white;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: bold;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">${temp}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })

      const marker = L.marker([station.latitude, station.longitude], { icon })
        .bindPopup(createPopupContent(station))

      markersLayerRef.current.addLayer(marker)
    })
  }

  function getMarkerColor(obs: any): string {
    if (!obs) return '#6b7280'
    if (obs.precipitation && obs.precipitation > 0) return '#8b5cf6'
    if (obs.air_temperature !== null) {
      if (obs.air_temperature > 33) return '#ef4444'
      if (obs.air_temperature > 28) return '#f97316'
      if (obs.air_temperature < 15) return '#3b82f6'
    }
    return '#10b981'
  }

  function formatTemp(temp: number | null): string {
    if (temp === null) return '-'
    return `${Math.round(temp)}°`
  }

  function createPopupContent(station: StationWithObservation): string {
    const obs = station.latest_observation
    const obsTime = obs?.observation_time 
      ? new Date(obs.observation_time).toLocaleString('zh-TW')
      : '-'

    return `
      <div style="min-width: 200px; font-family: sans-serif;">
        <h3 style="margin: 0 0 8px 0; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 6px;">
          ${station.station_name}
        </h3>
        <div style="font-size: 11px; color: #666; margin-bottom: 8px;">
          ${station.county_name} ${station.town_name}
        </div>
        ${obs ? `
          <div style="text-align: center; margin: 10px 0;">
            <span style="font-size: 28px; font-weight: bold; color: #e74c3c;">
              ${formatTemp(obs.air_temperature)}
            </span>
          </div>
          <table style="width: 100%; font-size: 12px;">
            <tr><td style="color: #666;">天氣</td><td style="text-align: right;">${obs.weather || '-'}</td></tr>
            <tr><td style="color: #666;">濕度</td><td style="text-align: right;">${obs.relative_humidity ?? '-'}%</td></tr>
            <tr><td style="color: #666;">風速</td><td style="text-align: right;">${obs.wind_speed ?? '-'} m/s</td></tr>
            <tr><td style="color: #666;">降雨</td><td style="text-align: right;">${obs.precipitation ?? '-'} mm</td></tr>
            <tr><td style="color: #666;">氣壓</td><td style="text-align: right;">${obs.air_pressure ?? '-'} hPa</td></tr>
          </table>
          <div style="margin-top: 8px; font-size: 10px; color: #999;">
            觀測時間: ${obsTime}
          </div>
        ` : '<div style="color: #999;">無觀測數據</div>'}
      </div>
    `
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div 
        ref={mapRef} 
        id="windy" 
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
