'use client'

import { useState, useRef, useEffect } from 'react'

interface TimelineProps {
  onTimeSelect: (timestamp: number) => void
  availableTimes: number[]
}

export default function Timeline({ onTimeSelect, availableTimes }: TimelineProps) {
  const now = new Date()
  const [selectedDate, setSelectedDate] = useState<Date>(now)
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null)
  const initialMount = useRef(true)

  const dates: Date[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dates.push(d)
  }

  const availableDates = new Set(
    availableTimes.map(ts => {
      const d = new Date(ts)
      return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    })
  )

  function getDateKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  }

  function hasData(date: Date): boolean {
    return availableDates.has(getDateKey(date))
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
    const ts = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)
    setSelectedTimestamp(ts.getTime())
  }

  function formatDateLabel(date: Date): string {
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const weekDay = weekDays[date.getDay()]
    return `${month}/${day} (${weekDay})`
  }

  function isToday(date: Date): boolean {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  function isSameDate(d1: Date, d2: Date): boolean {
    return d1.toDateString() === d2.toDateString()
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
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 8,
        padding: '0 20px',
        flexWrap: 'wrap',
      }}>
        {dates.map((date, index) => (
          <button
            key={index}
            onClick={() => hasData(date) && handleDateClick(date)}
            disabled={!hasData(date)}
            style={{
              background: isSameDate(date, selectedDate) 
                ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                : 'rgba(255,255,255,0.08)',
              color: hasData(date)
                ? isSameDate(date, selectedDate) ? 'white' : '#94a3b8'
                : '#374151',
              border: isSameDate(date, selectedDate)
                ? '1px solid rgba(59, 130, 246, 0.5)'
                : '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '10px 16px',
              cursor: hasData(date) ? 'pointer' : 'not-allowed',
              fontSize: 13,
              fontWeight: isSameDate(date, selectedDate) ? 600 : 400,
              transition: 'all 0.2s ease',
              opacity: hasData(date) ? 1 : 0.35,
            }}
          >
            <div>{formatDateLabel(date)}</div>
            {isToday(date) && (
              <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>今天</div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
