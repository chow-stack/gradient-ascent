import { dayKey, type DayKey } from '../../lib/dates'
import { shuffled } from '../../lib/random'
import { db, type DailyResult, type GradientDB, type MasteryRow } from '../../lib/db'
import { getItem, lessons } from '../content/content'
import { isCheckpoint, isProject, itemId, versionForReview, type Card, type Lesson } from '../content/schema'
import { checkpointsToRetake } from '../progress/progress'
import type { ItemSource } from '../progress/xp'
import { selectDaily } from './daily'

/**
 * Builds sessions (BUILD_PLAN §4):
 * - daily:    today's fixed set of up to 5 problems from everything learned. Finishing it counts the day.
 * - lesson:   the next lesson, checkpoint or project on the path. As many as you like.
 * - review:   extra reviews, soonest-due first ("keep going").
 * - practice: more reps on one lesson's exercises; doesn't change the review schedule.
 */
export type SessionKind = 'daily' | 'review' | 'practice' | 'lesson'

export type SessionItem = { key: string; itemId: string; lesson: Lesson; card: Card; source: ItemSource }

export type DailyPlan = { day: DayKey; itemIds: string[]; results: Record<string, DailyResult> }

export type SessionPlan = { kind: SessionKind; items: SessionItem[]; lessonId?: string; daily?: DailyPlan }

const REVIEW_MAX = 5
const REVIEW_MAX_CODE = 2 // fix/write take longer; keep the set short
const PRACTICE_MAX = 6

/**
 * Next lesson on the path: the first one not yet passed. Everything after it is locked.
 * Pass `retakeTomorrow` to skip a checkpoint that was failed today (nothing is available until tomorrow).
 */
export function nextLesson(mastery: Map<string, MasteryRow>, retakeTomorrow?: Set<string>): Lesson | undefined {
  const next = lessons.find((l) => !mastery.has(l.id))
  return next && retakeTomorrow?.has(next.id) ? undefined : next
}

export type LessonStatus = 'mastered' | 'passed' | 'next' | 'locked'
export function lessonStatus(lesson: Lesson, mastery: Map<string, MasteryRow>): LessonStatus {
  const m = mastery.get(lesson.id)
  if (m) return m.status
  return nextLesson(mastery)?.id === lesson.id ? 'next' : 'locked'
}

/** Spread items so the same lesson doesn't appear twice in a row when avoidable (interleaving). */
export function interleave(items: SessionItem[]): SessionItem[] {
  const groups = new Map<string, SessionItem[]>()
  for (const it of shuffled(items)) groups.set(it.lesson.id, [...(groups.get(it.lesson.id) ?? []), it])
  const out: SessionItem[] = []
  let last = ''
  while (out.length < items.length) {
    const options = [...groups.entries()].filter(([, g]) => g.length).sort((a, b) => b[1].length - a[1].length)
    const pick = options.find(([id]) => id !== last) ?? options[0]
    out.push(pick[1].shift()!)
    last = pick[0]
  }
  return out
}

/** A review item, showing the next version of the card if it has variants. */
async function reviewItem(id: string, keyPrefix: string, database: GradientDB): Promise<SessionItem | null> {
  const found = getItem(id)
  if (!found) return null // content was removed or renamed
  const reviews = await database.attempts
    .where('itemId')
    .equals(id)
    .filter((a) => a.source === 'review')
    .count()
  return {
    key: `${keyPrefix}:${id}`,
    itemId: id,
    lesson: found.lesson,
    card: versionForReview(found.card, reviews),
    source: 'review',
  }
}

async function reviewItems(database: GradientDB): Promise<SessionItem[]> {
  const rows = await database.reviews.orderBy('due').toArray()
  const picked: SessionItem[] = []
  let code = 0
  for (const r of rows) {
    const found = getItem(r.itemId)
    if (!found) continue
    const heavy = found.card.type === 'fix' || found.card.type === 'write'
    if (heavy && code >= REVIEW_MAX_CODE) continue
    if (heavy) code++
    const item = await reviewItem(r.itemId, 'review', database)
    if (item) picked.push(item)
    if (picked.length >= REVIEW_MAX) break
  }
  return interleave(picked)
}

/** Today's set, created the first time it's opened and fixed for the rest of the day. */
async function dailyPlan(now: Date, database: GradientDB): Promise<SessionPlan> {
  const day = dayKey(now)
  let row = await database.dailies.get(day)
  if (!row) {
    const itemIds = await selectDaily(now, database)
    if (itemIds.length === 0) return { kind: 'daily', items: [] }
    row = { day, itemIds, results: {} }
    await database.dailies.put(row)
  }
  const { itemIds, results } = row
  const items: SessionItem[] = []
  for (const id of itemIds) {
    if (results[id]) continue
    const item = await reviewItem(id, 'daily', database)
    if (item) items.push(item)
  }
  return { kind: 'daily', items, daily: { day, itemIds, results } }
}

function lessonItems(lesson: Lesson): SessionItem[] {
  const source: ItemSource = isCheckpoint(lesson) ? 'checkpoint' : isProject(lesson) ? 'project' : 'lesson'
  return lesson.cards.map((card) => {
    const id = itemId(lesson.id, card.id)
    return { key: `${source}:${id}`, itemId: id, lesson, card, source }
  })
}

function practiceItems(lesson: Lesson): SessionItem[] {
  const cards = lesson.cards.filter((c) => c.type !== 'learn' && c.type !== 'explain')
  return shuffled(cards)
    .slice(0, PRACTICE_MAX)
    .map((card) => {
      const id = itemId(lesson.id, card.id)
      return { key: `practice:${id}`, itemId: id, lesson, card, source: 'practice' as const }
    })
}

export async function buildSession(
  kind: SessionKind,
  opts: { lessonId?: string } = {},
  now = new Date(),
  database: GradientDB = db,
): Promise<SessionPlan> {
  if (kind === 'daily') return dailyPlan(now, database)
  const mastery = new Map((await database.mastery.toArray()).map((m) => [m.lessonId, m]))
  switch (kind) {
    case 'review':
      return { kind, items: await reviewItems(database) }
    case 'lesson': {
      const next = nextLesson(mastery, await checkpointsToRetake(now, database))
      return { kind, items: next ? lessonItems(next) : [], lessonId: next?.id }
    }
    case 'practice': {
      const passed = [...mastery.values()].sort((a, b) => b.passedOn.localeCompare(a.passedOn))
      const target = lessons.find((l) => l.id === (opts.lessonId ?? passed[0]?.lessonId))
      return { kind, items: target ? practiceItems(target) : [], lessonId: target?.id }
    }
  }
}
