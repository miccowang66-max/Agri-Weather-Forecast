'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { StationWithObservation } from '@/lib/types'
import WindyMap from '@/components/WindyMap'

export default function Home() {
  const [stations, setStations] = useState<StationWithObservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [stats, setStats] = useState({
    count: 0,
    avgTemp: 0,
    maxTemp: 0,
    minTemp: 0,
  })

  useEffect(() => {
    if (!supabase) {
      setError('Supabase not configured. Please set environment variables.')
      setLoading(false)
      return
    }

    fetchStations()

    // Subscribe to realtime updates
    const channel = supabase
      .channel('weather_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'weather_observations' },
        () => fetchStations()
      )
      .subscribe()

    return () => {
      supabase?.removeChannel(channel)
    }
  }, [])

  async function fetchStations() {
    if (!supabase) return

    try {
      // Fetch latest observation for each station
      const { data: observations, error: obsError } = await supabase
        .from('weather_observations')
        .select('*')
        .order('observation_time', { ascending: false })
        .limit(1000)

      if (obsError) throw obsError

      // Get unique stations with their latest observation
      const stationMap = new Map<string, StationWithObservation>()
      
      for (const obs of observations || []) {
        if (!stationMap.has(obs.station_id)) {
          // Fetch station info
          const { data: station } = await supabase
            .from('weather_stations')
            .select('*')
            .eq('station_id', obs.station_id)
            .single()

          if (station) {
            stationMap.set(obs.station_id, {
              ...station,
              latest_observation: obs,
            })
          }
        }
      }

      const stationsData = Array.from(stationMap.values())
      setStations(stationsData)

      // Calculate stats
      const temps = stationsData
        .map(s => s.latest_observation?.air_temperature)
        .filter((t): t is number => t !== null)

      if (temps.length > 0) {
        setStats({
          count: stationsData.length,
          avgTemp: Math.round(temps.reduce((a, b) => a + b, 0) / temps.length * 10) / 10,
          maxTemp: Math.max(...temps),
          minTemp: Math.min(...temps),
        })
      }

      setLastUpdate(new Date().toLocaleString('zh-TW'))
      setLoading(false)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#0f172a',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48,
            height: 48,
            border: '4px solid #1e293b',
            borderTopColor: '#38bdf8',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <div>載入氣象數據中...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#0f172a',
      }}>
        <div style={{ textAlign: 'center', color: '#ef4444', padding: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ maxWidth: 400 }}>{error}</div>
        </div>
      </div>
    )
  }

  return (
    <main style={{ height: '100vh', position: 'relative' }}>
      {/* Header */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: 'linear-gradient(to right, #0f172a, #1e293b)',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>
          🌤 台灣天氣觀測地圖
        </h1>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          更新時間: {lastUpdate || '-'}
        </div>
      </header>

      {/* Map */}
      <div style={{ height: '100%', paddingTop: 50 }}>
        <WindyMap stations={stations} />
      </div>

      {/* Stats Panel */}
      <div style={{
        position: 'fixed',
        bottom: 20,
        left: 20,
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.9)',
        padding: 16,
        borderRadius: 8,
        fontSize: 13,
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>📊 統計資訊</div>
        <div>站點數量: {stats.count}</div>
        <div>平均氣溫: {stats.avgTemp}°C</div>
        <div>最高氣溫: {stats.maxTemp}°C</div>
        <div>最低氣溫: {stats.minTemp}°C</div>
      </div>

      {/* Legend */}
      <div style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.9)',
        padding: 16,
        borderRadius: 8,
        fontSize: 12,
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>圖例</div>
        {[
          { color: '#ef4444', label: '高溫 (>33°C)' },
          { color: '#f97316', label: '溫暖 (28-33°C)' },
          { color: '#10b981', label: '適溫 (15-28°C)' },
          { color: '#3b82f6', label: '低溫 (<15°C)' },
          { color: '#8b5cf6', label: '有降雨' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', margin: '4px 0' }}>
            <div style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: item.color,
              marginRight: 8,
              border: '1px solid rgba(255,255,255,0.2)',
            }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </main>
  )
}
