'use client'

import { useState, useRef, useEffect, useMemo } from 'react'

interface TimelineProps {
  onTimeSelect: (timestamp: number) => void
  availableTimes: number[]
}

export default function Timeline({ onTimeSelect, availableTimes }: TimelineProps) {
  const now = new Date()
  const [selectedDate, setSelectedDate] = useState<Date>(now)
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const initialMount = useRef(true)

  const dates: Date[] = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    dates.push(date)
  }

  function getDateKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  }

  function getDateHourKey(date: Date, hour: number): string {
    return `${getDateKey(date)}-${hour}`
  }

  const { timestampsByDateHour, hoursByDate, timestampsByHour } = useMemo(() => {
    const tsMap = new Map<string, number[]>()
    const hourMap = new Map<string, number[]>()
    const bestTsMap = new Map<string, number>()

    for (const ts of availableTimes) {
      const d = new Date(ts)
      const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
      const hour = d.getHours()

      if (!tsMap.has(dateKey)) {
        tsMap.set(dateKey, [])
      }
      tsMap.get(dateKey)!.push(ts)

      if (!hourMap.has(dateKey)) {
        hourMap.set(dateKey, [])
      }
      const hours = hourMap.get(dateKey)!
      if (!hours.includes(hour)) {
        hours.push(hour)
      }

      const dhKey = `${dateKey}-${hour}`
      if (!bestTsMap.has(dhKey) || ts > bestTsMap.get(dhKey)!) {
        bestTsMap.set(dhKey, ts)
      }
    }

    for (const hours of Array.from(hourMap.values())) {
      hours.sort((a, b) => a - b)
    }

    return {
      timestampsByDateHour: bestTsMap,
      hoursByDate: hourMap,
      timestampsByHour: tsMap,
    }
  }, [availableTimes])

  const timestampsForSelectedDate = useMemo(() => {
    const key = getDateKey(selectedDate)
    const all = timestampsByHour.get(key) || []
    const uniqueSorted = Array.from(new Set(all)).sort((a, b) => a - b)
    return uniqueSorted
  }, [selectedDate, timestampsByHour])

  function getAvailableHoursForDate(date: Date): number[] {
    return hoursByDate.get(getDateKey(date)) || []
  }

  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false
      if (availableTimes.length > 0) {
        const latest = availableTimes[availableTimes.length - 1]
        setSelectedTimestamp(latest)
      }
      return
    }
  }, [availableTimes])

  useEffect(() => {
    if (selectedTimestamp === null) return
    if (initialMount.current) return
    onTimeSelect(selectedTimestamp)
  }, [selectedTimestamp])

  function handleDateClick(date: Date) {
    setSelectedDate(date)
    const hours = getAvailableHoursForDate(date)
    if (hours.length > 0) {
      let bestHour = hours[0]
      if (isToday(date)) {
        let minDiff = Infinity
        for (const h of hours) {
          const diff = Math.abs(h - now.getHours())
          if (diff < minDiff && h <= now.getHours()) {
            minDiff = diff
            bestHour = h
          }
        }
      }
      const actualTs = timestampsByDateHour.get(getDateHourKey(date, bestHour))
      if (actualTs !== undefined) {
        setSelectedTimestamp(actualTs)
      }
    }
  }

  function handleTimestampClick(ts: number) {
    setSelectedTimestamp(ts)
  }

  function formatDate(date: Date): string {
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const weekDay = weekDays[date.getDay()]
    return `${month}/${day} (${weekDay})`
  }

  function formatTimestamp(ts: number): string {
    const d = new Date(ts)
    const hour = d.getHours().toString().padStart(2, '0')
    const minute = d.getMinutes().toString().padStart(2, '0')
    return `${hour}:${minute}`
  }

  function isToday(date: Date): boolean {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  function isSameDate(d1: Date, d2: Date): boolean {
    return d1.toDateString() === d2.toDateString()
  }

  function isSelectedTimestamp(ts: number): boolean {
    return selectedTimestamp === ts
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      background: 'linear-gradient(to top, rgba(15, 23, 42, 0.98), rgba(15, 23, 42, 0.9))',
      backdropFilter: 'blur(12px)',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      padding: '12px 0 8px',
    }}>
      {/* Date selector */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 12,
        padding: '0 20px',
      }}>
        {dates.map((date, index) => {
          const hasData = getAvailableHoursForDate(date).length > 0
          return (
            <button
              key={index}
              onClick={() => hasData && handleDateClick(date)}
              disabled={!hasData}
              style={{
                background: isSameDate(date, selectedDate) 
                  ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                  : 'rgba(255,255,255,0.08)',
                color: hasData
                  ? isSameDate(date, selectedDate) ? 'white' : '#94a3b8'
                  : '#374151',
                border: isSameDate(date, selectedDate)
                  ? '1px solid rgba(59, 130, 246, 0.5)'
                  : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: '8px 12px',
                cursor: hasData ? 'pointer' : 'not-allowed',
                fontSize: 12,
                fontWeight: isSameDate(date, selectedDate) ? 600 : 400,
                transition: 'all 0.2s ease',
                minWidth: 70,
                opacity: hasData ? 1 : 0.35,
              }}
            >
              <div>{formatDate(date)}</div>
              {isToday(date) && (
                <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>今天</div>
              )}
            </button>
          )
        })}
      </div>

      {/* Timestamp selector */}
      <div 
        ref={scrollRef}
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          padding: '0 20px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          minHeight: 32,
        }}
      >
        {timestampsForSelectedDate.length === 0 ? (
          <div style={{
            color: '#64748b',
            fontSize: 11,
            padding: '6px 0',
            width: '100%',
            textAlign: 'center',
          }}>
            此時段無觀測資料
          </div>
        ) : (
          timestampsForSelectedDate.map((ts) => {
            const isFuture = isToday(selectedDate) && ts > now.getTime()
            const selected = isSelectedTimestamp(ts)
            return (
              <button
                key={ts}
                onClick={() => !isFuture && handleTimestampClick(ts)}
                disabled={isFuture}
                style={{
                  background: isFuture 
                    ? 'rgba(255,255,255,0.02)'
                    : selected
                      ? 'linear-gradient(135deg, #f97316, #ea580c)'
                      : 'rgba(255,255,255,0.05)',
                  color: isFuture 
                    ? '#374151'
                    : selected ? 'white' : '#64748b',
                  border: isFuture
                    ? '1px solid transparent'
                    : selected
                      ? '1px solid rgba(249, 115, 22, 0.5)'
                      : '1px solid transparent',
                  borderRadius: 6,
                  padding: '6px 10px',
                  cursor: isFuture ? 'not-allowed' : 'pointer',
                  fontSize: 11,
                  fontWeight: selected ? 600 : 400,
                  transition: 'all 0.2s ease',
                  minWidth: 48,
                  flexShrink: 0,
                  opacity: isFuture ? 0.3 : 1,
                }}
              >
                {formatTimestamp(ts)}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
