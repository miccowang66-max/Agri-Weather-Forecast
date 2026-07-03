'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { StationWithObservation, WeatherStation } from '@/lib/types'
import WeatherMap from '@/components/WeatherMap'
import Timeline from '@/components/Timeline'

export default function Home() {
  const [stations, setStations] = useState<StationWithObservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [stats, setStats] = useState({
    count: 0,
    avgTemp: 0,
    maxTemp: 0,
    minTemp: 0,
  })

  const [availableTimes, setAvailableTimes] = useState<number[]>([])
  const stationsByNameMap = useRef<Record<string, WeatherStation>>({})
  const latestRequestRef = useRef<number>(0)

  useEffect(() => {
    if (!supabase) {
      setError('Supabase not configured. Please set environment variables.')
      setLoading(false)
      return
    }

    async function init() {
      try {
        const { data: allStations, error: stErr } = await supabase!
          .from('weather_stations')
          .select('*')
        if (stErr) throw stErr

        const map: Record<string, WeatherStation> = {}
        for (const s of allStations || []) {
          map[s.station_id] = s
        }
        stationsByNameMap.current = map

        const now = new Date()
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        const { data: times } = await supabase!
          .from('weather_observations')
          .select('observation_time')
          .gte('observation_time', sevenDaysAgo.toISOString())
          .lte('observation_time', now.toISOString())
          .order('observation_time', { ascending: true })
          .limit(10000)

        if (times) {
          const uniqueTimestamps = Array.from(
            new Set(times.map((t: any) => new Date(t.observation_time).getTime()))
          )
          setAvailableTimes(uniqueTimestamps)
        }

        await loadObservationsForTime(now.getTime())
        setLoading(false)
      } catch (err: any) {
        setError(err.message)
        setLoading(false)
      }
    }

    init()
  }, [])

  async function loadObservationsForTime(timestamp: number) {
    if (!supabase) return

    const targetTime = new Date(timestamp)
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    if (targetTime > now || targetTime < sevenDaysAgo) {
      return
    }

    latestRequestRef.current = timestamp

    setSelectedTime(targetTime.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }))

    const BUFFER_MS = 3 * 60 * 1000
    const start = new Date(timestamp - BUFFER_MS).toISOString()
    const end = new Date(timestamp + BUFFER_MS).toISOString()

    const { data: observations, error: obsErr } = await supabase
      .from('weather_observations')
      .select('*')
      .gte('observation_time', start)
      .lte('observation_time', end)
      .order('observation_time', { ascending: false })
      .limit(10000)

    if (latestRequestRef.current !== timestamp) {
      return
    }

    if (obsErr) {
      console.error('Query error:', obsErr)
      return
    }

    const bestPerStation = new Map<string, any>()
    for (const obs of observations || []) {
      if (bestPerStation.has(obs.station_id)) continue
      bestPerStation.set(obs.station_id, obs)
    }

    const result: StationWithObservation[] = []
    bestPerStation.forEach((obs, stationId) => {
      const station = stationsByNameMap.current[stationId]
      if (station) {
        result.push({ ...station, latest_observation: obs })
      }
    })

    setStations(result)

    const temps = result
      .map(s => s.latest_observation?.air_temperature)
      .filter((t): t is number => t !== null)

    setStats({
      count: result.length,
      avgTemp: temps.length > 0 ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length * 10) / 10 : 0,
      maxTemp: temps.length > 0 ? Math.max(...temps) : 0,
      minTemp: temps.length > 0 ? Math.min(...temps) : 0,
    })
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
          {selectedTime ? `顯示時間: ${selectedTime}` : '顯示最新觀測資料'}
        </div>
      </header>

      <div style={{ height: '100%', paddingTop: 50, paddingBottom: 100 }}>
        <WeatherMap stations={stations} />
      </div>

      <Timeline onTimeSelect={loadObservationsForTime} availableTimes={availableTimes} />

      <div style={{
        position: 'fixed',
        bottom: 120,
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

      <div style={{
        position: 'fixed',
        bottom: 120,
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
