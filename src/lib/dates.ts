import { useEffect, useState } from 'react'

/** Calendar days are local-time "YYYY-MM-DD" strings; that's what a streak counts. */
export type DayKey = string

export function dayKey(d: Date = new Date()): DayKey {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDay(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: DayKey, n: number): DayKey {
  const d = parseDay(key)
  d.setDate(d.getDate() + n)
  return dayKey(d)
}

/** Monday of the week containing `key` (weeks start Monday). */
export function weekStart(key: DayKey): DayKey {
  const d = parseDay(key)
  const offset = (d.getDay() + 6) % 7
  return addDays(key, -offset)
}

/** Start of the next local day, as epoch ms. */
export function startOfTomorrow(d: Date = new Date()): number {
  const t = new Date(d)
  t.setHours(24, 0, 0, 0)
  return t.getTime()
}

/** End of the local day, as epoch ms. Reviews due any time today count as due now. */
export function endOfDay(d: Date = new Date()): number {
  const e = new Date(d)
  e.setHours(23, 59, 59, 999)
  return e.getTime()
}

/** Time until the next local day, like "7h 12m". Updates once a minute. */
export function useNextDayCountdown(): string {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  const minutes = Math.ceil((startOfTomorrow(now) - now.getTime()) / 60_000)
  const h = Math.floor(minutes / 60)
  return h > 0 ? `${h}h ${minutes % 60}m` : `${minutes}m`
}
