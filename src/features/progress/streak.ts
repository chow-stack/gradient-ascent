import { addDays, weekStart, type DayKey } from '../../lib/dates'

export const FREEZES_PER_WEEK = 2

export type StreakInfo = {
  /** Days in a row with a finished core session (frozen days keep it alive but don't add). */
  current: number
  todayDone: boolean
  /** Freezes still available this week. */
  freezesLeft: number
  /** Missed days that a freeze covered. */
  frozenDays: DayKey[]
}

/**
 * Pure streak calculation. Freezes are applied automatically: up to 2 missed days per week are
 * forgiven, as long as the streak continues on the other side. No writes, no guilt.
 */
export function computeStreak(doneDays: Iterable<DayKey>, today: DayKey): StreakInfo {
  const done = new Set(doneDays)
  const todayDone = done.has(today)
  const earliest = [...done].sort()[0]
  const usedPerWeek = new Map<DayKey, number>()
  const frozen: DayKey[] = []
  let tentative: DayKey[] = []
  let current = 0

  if (earliest) {
    let day = todayDone ? today : addDays(today, -1)
    while (day >= earliest) {
      if (done.has(day)) {
        current++
        frozen.push(...tentative)
        tentative = []
      } else {
        const week = weekStart(day)
        const used = usedPerWeek.get(week) ?? 0
        if (used >= FREEZES_PER_WEEK) break
        usedPerWeek.set(week, used + 1)
        tentative.push(day)
      }
      day = addDays(day, -1)
    }
  }

  const thisWeek = weekStart(today)
  const usedThisWeek = frozen.filter((d) => weekStart(d) === thisWeek).length
  return { current, todayDone, freezesLeft: FREEZES_PER_WEEK - usedThisWeek, frozenDays: frozen }
}
