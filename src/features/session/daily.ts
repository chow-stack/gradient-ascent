import { addDays, dayKey, endOfDay } from '../../lib/dates'
import type { DailyResult, GradientDB } from '../../lib/db'
import { shuffled } from '../../lib/random'
import { getItem } from '../content/content'
import type { FreshTaskRow } from '../../lib/db'

const DAILY_SIZE = 5
const MAX_CODE = 2 // fix and write take longer
const TOP_UP_WINDOW_DAYS = 7

const isCode = (id: string) => {
  const type = getItem(id)?.card.type
  return type === 'fix' || type === 'write'
}

/**
 * Today's set: with coding tasks ready, 3 quick review cards and then the 2 tasks. Without, 5 review problems,
 * up to 2 of them code.
 */
export async function dailyItemIds(now: Date, database: GradientDB, tasks: FreshTaskRow[]): Promise<string[]> {
  // After a reset, everything due was likely just answered, so the cards come from any passed lesson instead.
  const random = !!(await database.days.get(dayKey(now)))?.dailyReset
  if (!tasks.length) return selectDaily(now, database, { random })
  const reviews = await selectDaily(now, database, { size: DAILY_SIZE - tasks.length, code: false, random })
  return [...reviews, ...tasks.map((t) => t.id)]
}

/**
 * Chooses today's review problems, in the order they'll be shown:
 * - due reviews first, most overdue first; the pool grows but the count doesn't
 * - if fewer than 5 are due, top up with what's due soonest, leaving out anything seen yesterday
 * - never anything already seen today, so a problem enters the pool the day after it's first seen
 * - at most 2 code problems unless nothing else is left, and those go last
 * - with `code: false` (coding tasks cover code that day), no code problems at all
 * - with `random` (after a reset), any card from a passed lesson, in random order, due or not; ones not seen today
 *   first, and never more than 2 code problems
 */
export async function selectDaily(
  now: Date,
  database: GradientDB,
  { size = DAILY_SIZE, code: withCode = true, random = false } = {},
): Promise<string[]> {
  const today = dayKey(now)
  const yesterday = addDays(today, -1)
  const [rows, recent] = await Promise.all([
    database.reviews.orderBy('due').toArray(),
    database.attempts.where('day').anyOf(today, yesterday).toArray(),
  ])
  const seenToday = new Set(recent.filter((a) => a.day === today).map((a) => a.itemId))
  const seenYesterday = new Set(recent.filter((a) => a.day === yesterday).map((a) => a.itemId))
  const dueBy = endOfDay(now)
  const topUpBy = dueBy + TOP_UP_WINDOW_DAYS * 86_400_000

  const pool = random
    ? (() => {
        const all = shuffled(
          rows.filter((r) => getItem(r.itemId) && (withCode || !isCode(r.itemId))).map((r) => r.itemId),
        )
        return [...all.filter((id) => !seenToday.has(id)), ...all.filter((id) => seenToday.has(id))]
      })()
    : rows
        .filter((r) => getItem(r.itemId) && !seenToday.has(r.itemId) && (withCode || !isCode(r.itemId)))
        .filter((r) => r.due <= dueBy || (r.due <= topUpBy && !seenYesterday.has(r.itemId)))
        .map((r) => r.itemId)

  const picked: string[] = []
  let code = 0
  for (const id of pool) {
    if (picked.length === size) break
    if (isCode(id) && code === MAX_CODE) continue
    if (isCode(id)) code++
    picked.push(id)
  }
  // Only when nothing else is left: more code problems rather than a short set. A reset never needs this.
  for (const id of random ? [] : pool) {
    if (picked.length === size) break
    if (!picked.includes(id)) picked.push(id)
  }

  const quick = shuffled(picked.filter((id) => !isCode(id)))
  return [...spreadLessons(quick), ...picked.filter(isCode)]
}

/** Avoid two problems from the same lesson in a row when possible. */
function spreadLessons(ids: string[]): string[] {
  const left = [...ids]
  const out: string[] = []
  while (left.length) {
    const last = out.length ? getItem(out[out.length - 1])?.lesson.id : undefined
    const i = left.findIndex((id) => getItem(id)?.lesson.id !== last)
    out.push(...left.splice(Math.max(i, 0), 1))
  }
  return out
}

/** Spoken summary, since the tiles themselves are only color and an icon. */
export function describeDaily(results: (DailyResult | null)[]): string {
  const count = (r: DailyResult | null) => results.filter((x) => x === r).length
  const parts = [
    `${count('clean')} right first try`,
    `${count('assisted')} right with help`,
    `${count('missed')} missed`,
    `${count(null)} to go`,
  ]
  return `${results.length} problems: ${parts.join(', ')}`
}
