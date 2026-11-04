import { endOfDay } from '../../lib/dates'
import { shuffled } from '../../lib/random'
import { db, type GradientDB, type MasteryRow } from '../../lib/db'
import { getItem, lessons } from '../content/content'
import { itemId, type Card, type Lesson } from '../content/schema'
import type { ItemSource } from '../progress/xp'

/**
 * Builds sessions (BUILD_PLAN §4):
 * - core:     warm-up reviews (due, interleaved, ≤ 5) → the next lesson's ladder. Finishing it counts the day.
 * - review:   extra reviews, soonest-due first ("keep going").
 * - practice: more reps on one lesson's exercises; doesn't change the review schedule.
 * - lesson:   just the next lesson.
 */
export type SessionKind = 'core' | 'review' | 'practice' | 'lesson'

export type SessionItem = { key: string; itemId: string; lesson: Lesson; card: Card; source: ItemSource }

export type SessionPlan = { kind: SessionKind; items: SessionItem[]; lessonId?: string }

const WARMUP_MAX = 5
const WARMUP_MAX_CODE = 2 // fix/write take longer; keep the warm-up short
const PRACTICE_MAX = 6

/** Next lesson on the path: the first one not yet passed. Everything after it is locked. */
export function nextLesson(mastery: Map<string, MasteryRow>): Lesson | undefined {
  return lessons.find((l) => !mastery.has(l.id))
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

async function reviewItems(due: boolean, now: Date, database: GradientDB): Promise<SessionItem[]> {
  const rows = due
    ? await database.reviews.where('due').belowOrEqual(endOfDay(now)).sortBy('due')
    : await database.reviews.orderBy('due').toArray()
  const picked: SessionItem[] = []
  let code = 0
  for (const r of rows) {
    const found = getItem(r.itemId)
    if (!found) continue // content was removed or renamed
    const heavy = found.card.type === 'fix' || found.card.type === 'write'
    if (heavy && code >= WARMUP_MAX_CODE) continue
    if (heavy) code++
    picked.push({ key: `review:${r.itemId}`, itemId: r.itemId, ...found, source: 'review' })
    if (picked.length >= WARMUP_MAX) break
  }
  return interleave(picked)
}

function lessonItems(lesson: Lesson): SessionItem[] {
  return lesson.cards.map((card) => {
    const id = itemId(lesson.id, card.id)
    return { key: `lesson:${id}`, itemId: id, lesson, card, source: 'lesson' as const }
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
  const mastery = new Map((await database.mastery.toArray()).map((m) => [m.lessonId, m]))
  const next = nextLesson(mastery)

  switch (kind) {
    case 'core': {
      const reviews = await reviewItems(true, now, database)
      return { kind, items: [...reviews, ...(next ? lessonItems(next) : [])], lessonId: next?.id }
    }
    case 'review':
      return { kind, items: await reviewItems(false, now, database) }
    case 'lesson':
      return { kind, items: next ? lessonItems(next) : [], lessonId: next?.id }
    case 'practice': {
      const passed = [...mastery.values()].sort((a, b) => b.passedOn.localeCompare(a.passedOn))
      const target = lessons.find((l) => l.id === (opts.lessonId ?? passed[0]?.lessonId))
      return { kind, items: target ? practiceItems(target) : [], lessonId: target?.id }
    }
  }
}
