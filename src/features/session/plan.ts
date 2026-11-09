import { dayKey, type DayKey } from '../../lib/dates'
import { shuffled } from '../../lib/random'
import { db, type DailyResult, type GradientDB, type MasteryRow } from '../../lib/db'
import { getItem, lessons } from '../content/content'
import {
  cardVariants,
  isCheckpoint,
  isProject,
  itemId,
  versionForReview,
  type Card,
  type Lesson,
} from '../content/schema'
import type { ItemSource } from '../progress/xp'
import { selectDaily } from './daily'
import { loadResume, type Resume } from './resume'

/**
 * Builds sessions (BUILD_PLAN §4):
 * - daily:    today's fixed set of up to 5 problems from everything learned. Finishing it counts the day.
 * - lesson:   the next lesson, checkpoint or project on the path. As many as you like.
 * - review:   extra reviews, soonest-due first ("keep going").
 * - practice: more reps on one lesson's exercises; doesn't change the review schedule.
 * - debug:    any lesson, starting at any card, free to jump around. Saves nothing (see lib/debug.ts).
 */
export type SessionKind = 'daily' | 'review' | 'practice' | 'lesson' | 'debug'

export type SessionItem = {
  key: string
  itemId: string
  lesson: Lesson
  card: Card
  source: ItemSource
  /** Which version of the card this is (0 is the card itself). */
  version?: number
}

export type DailyPlan = { day: DayKey; itemIds: string[]; results: Record<string, DailyResult> }

export type SessionPlan = {
  kind: SessionKind
  items: SessionItem[]
  lessonId?: string
  daily?: DailyPlan
  /** Debug sessions: the card to start at. */
  startAt?: number
  /** A lesson left part-way: where to pick up. */
  resume?: Resume
}

const REVIEW_MAX = 5
const REVIEW_MAX_CODE = 2 // fix/write take longer; keep the set short
const PRACTICE_MAX = 6
/** Questions a checkpoint test adds from the unit's lessons, on top of its own. */
const TEST_EXTRA = 4

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

/** A card's versions: the card itself, then its variants. */
const versions = (card: Card) => [card, ...cardVariants(card)]

/**
 * A checkpoint test: its own questions, plus a few from the unit's lessons in a version not seen there, shuffled.
 * Each retake moves its own questions on to their next version, so a retake can't be passed from memory.
 */
async function testItems(lesson: Lesson, database: GradientDB): Promise<SessionItem[]> {
  const own = await Promise.all(
    lesson.cards.map(async (card) => {
      const id = itemId(lesson.id, card.id)
      const taken = await database.attempts
        .where('itemId')
        .equals(id)
        .filter((a) => a.source === 'checkpoint')
        .count()
      const all = versions(card)
      const version = taken % all.length
      return { key: `checkpoint:${id}`, itemId: id, lesson, card: all[version], source: 'checkpoint' as const, version }
    }),
  )
  const extra: SessionItem[] = []
  const unitLessons = shuffled(lessons.filter((l) => l.unit === lesson.unit && l.kind === 'lesson'))
  for (const l of unitLessons) {
    if (extra.length >= TEST_EXTRA) break
    const cards = l.cards.filter((c) => c.type !== 'learn' && c.type !== 'explain' && cardVariants(c).length > 0)
    if (!cards.length) continue
    const card = shuffled(cards)[0]
    const all = versions(card)
    const version = 1 + Math.floor(Math.random() * (all.length - 1))
    const id = itemId(l.id, card.id)
    extra.push({ key: `checkpoint:${id}`, itemId: id, lesson: l, card: all[version], source: 'checkpoint', version })
  }
  return shuffled([...own, ...extra])
}

/** The items a lesson was left with, rebuilt from its saved place. Null if the content has changed since. */
function resumedItems(lesson: Lesson, resume: Resume): SessionItem[] | null {
  const source: ItemSource = isCheckpoint(lesson) ? 'checkpoint' : isProject(lesson) ? 'project' : 'lesson'
  const items: SessionItem[] = []
  for (const { itemId: id, version } of resume.items) {
    const found = getItem(id)
    const card = found && versions(found.card)[version]
    if (!found || !card) return null
    items.push({ key: `${source}:${id}`, itemId: id, lesson: found.lesson, card, source, version })
  }
  return items
}

/** Each practice round moves a card on to its next version, separately from its review cycle. */
async function practiceItems(lesson: Lesson, database: GradientDB): Promise<SessionItem[]> {
  const cards = lesson.cards.filter((c) => c.type !== 'learn' && c.type !== 'explain')
  return Promise.all(
    shuffled(cards)
      .slice(0, PRACTICE_MAX)
      .map(async (card) => {
        const id = itemId(lesson.id, card.id)
        const rounds = await database.attempts
          .where('itemId')
          .equals(id)
          .filter((a) => a.source === 'practice')
          .count()
        return {
          key: `practice:${id}`,
          itemId: id,
          lesson,
          card: versionForReview(card, rounds),
          source: 'practice' as const,
        }
      }),
  )
}

export async function buildSession(
  kind: SessionKind,
  opts: { lessonId?: string; cardId?: string } = {},
  now = new Date(),
  database: GradientDB = db,
): Promise<SessionPlan> {
  if (kind === 'daily') return dailyPlan(now, database)
  if (kind === 'debug') {
    const lesson = lessons.find((l) => l.id === opts.lessonId)
    if (!lesson) return { kind, items: [] }
    const at = lesson.cards.findIndex((c) => c.id === opts.cardId)
    return { kind, items: lessonItems(lesson), lessonId: lesson.id, startAt: Math.max(0, at) }
  }
  const mastery = new Map((await database.mastery.toArray()).map((m) => [m.lessonId, m]))
  switch (kind) {
    case 'review':
      return { kind, items: await reviewItems(database) }
    case 'lesson': {
      const next = nextLesson(mastery)
      if (!next) return { kind, items: [] }
      const resume = loadResume(next.id)
      const resumed = resume && resumedItems(next, resume)
      if (resume && resumed) return { kind, items: resumed, lessonId: next.id, resume }
      const items = isCheckpoint(next) ? await testItems(next, database) : lessonItems(next)
      return { kind, items, lessonId: next.id }
    }
    case 'practice': {
      const passed = [...mastery.values()].sort((a, b) => b.passedOn.localeCompare(a.passedOn))
      const target = lessons.find((l) => l.id === (opts.lessonId ?? passed[0]?.lessonId))
      return { kind, items: target ? await practiceItems(target, database) : [], lessonId: target?.id }
    }
  }
}
