'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { StationWithObservation, WeatherStation } from '@/lib/types'
import WindyMap from '@/components/WindyMap'
import Timeline from '@/components/Timeline'

const TARGET_HOUR = 12

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

        const { data: latestRow } = await supabase!
          .from('weather_observations')
          .select('observation_time')
          .order('observation_time', { ascending: false })
          .limit(1)

        let latestTs = 0
        if (latestRow && latestRow.length > 0) {
          latestTs = new Date(latestRow[0].observation_time).getTime()
        }

        const dateSet = new Set<number>()
        for (let i = 0; i < 7; i++) {
          const d = new Date(now)
          d.setDate(d.getDate() - i)
          const start = new Date(d.getFullYear(), d.getMonth(), d.getDate())
          const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
          const { data: check } = await supabase!
            .from('weather_observations')
            .select('id')
            .gte('observation_time', start.toISOString())
            .lte('observation_time', end.toISOString())
            .limit(1)
          if (check && check.length > 0) {
            dateSet.add(start.getTime())
          }
        }

        const times: number[] = []
        for (const ts of Array.from(dateSet)) {
          const d = new Date(ts)
          times.push(new Date(d.getFullYear(), d.getMonth(), d.getDate(), TARGET_HOUR, 0, 0).getTime())
        }
        if (latestTs && !times.includes(latestTs)) {
          times.push(latestTs)
        }
        times.sort((a, b) => a - b)
        setAvailableTimes(times)

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

    const dayStart = new Date(targetTime.getFullYear(), targetTime.getMonth(), targetTime.getDate())
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

    const { data: observations } = await supabase
      .from('weather_observations')
      .select('*')
      .gte('observation_time', dayStart.toISOString())
      .lte('observation_time', dayEnd.toISOString())
      .order('observation_time', { ascending: true })
      .limit(10000)

    if (latestRequestRef.current !== timestamp) {
      return
    }

    const bestPerStation = new Map<string, any>()
    for (const obs of observations || []) {
      const obsTs = new Date(obs.observation_time).getTime()
      const cur = bestPerStation.get(obs.station_id)
      if (!cur || Math.abs(obsTs - timestamp) < Math.abs(cur.ts - timestamp)) {
        bestPerStation.set(obs.station_id, { obs, ts: obsTs })
      }
    }

    const result: StationWithObservation[] = []
    bestPerStation.forEach(({ obs }, stationId) => {
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

      <div style={{ height: '100%', paddingTop: 50, paddingBottom: 70 }}>
        <WindyMap stations={stations} />
      </div>

      <Timeline onTimeSelect={loadObservationsForTime} availableTimes={availableTimes} />

      <div style={{
        position: 'fixed',
        bottom: 80,
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
        bottom: 80,
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
