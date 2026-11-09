import { endOfDay, parseDay, startOfTomorrow } from '../../lib/dates'
import { db, type DailyResult, type GradientDB, type MasteryRow, type TaskLevel } from '../../lib/db'
import { lessons } from '../content/content'
import type { Lesson } from '../content/schema'
import { schedule, type FsrsCard } from '../review/fsrs'
import type { Outcome } from '../progress/xp'

/**
 * Which lessons the Daily 5's coding tasks are built around. Every passed lesson with code exercises is a topic
 * with its own FSRS schedule: a task that went well pushes the lesson out, a miss brings it back soon.
 */

export const freshId = (day: string, slot: number) => `fresh:${day}:${slot}`
export const isFreshId = (id: string) => id.startsWith('fresh:')

/** Passed lessons that teach something a coding task can practise. */
export function topicLessons(mastery: Map<string, MasteryRow>): Lesson[] {
  return lessons.filter(
    (l) => l.kind === 'lesson' && mastery.has(l.id) && l.cards.some((c) => c.type === 'write' || c.type === 'fix'),
  )
}

/**
 * The `n` most due topics, leaving out `exclude`. A lesson never practised this way counts as due since the day it
 * was passed. The second pick comes from another unit when one is due too, so the two tasks feel different.
 */
export async function pickTopics(
  now: Date,
  mastery: Map<string, MasteryRow>,
  n: number,
  exclude: ReadonlySet<string>,
  database: GradientDB = db,
): Promise<Lesson[]> {
  const rows = new Map((await database.topics.toArray()).map((r) => [r.lessonId, r.due]))
  const dueAt = (l: Lesson) => rows.get(l.id) ?? parseDay(mastery.get(l.id)!.passedOn).getTime()
  const pool = topicLessons(mastery)
    .filter((l) => !exclude.has(l.id))
    .map((l) => ({ l, due: dueAt(l), tie: Math.random() }))
    .sort((a, b) => a.due - b.due || a.tie - b.tie)
  const today = endOfDay(now)
  const picked: Lesson[] = []
  while (picked.length < n) {
    const rest = pool.filter((x) => !picked.includes(x.l))
    if (!rest.length) break
    const other = rest.find((x) => x.due <= today && picked.every((p) => p.unit !== x.l.unit))
    picked.push((other ?? rest[0]).l)
  }
  return picked
}

/** Moves a topic's schedule after one of its tasks. Seen today, so tomorrow at the earliest. */
export async function scheduleTopic(lessonId: string, o: Outcome, now = new Date(), database: GradientDB = db) {
  const row = await database.topics.get(lessonId)
  const card = await schedule((row?.card as FsrsCard | undefined) ?? null, o, now)
  await database.topics.put({
    lessonId,
    card,
    due: Math.max(new Date(card.dueAt).getTime(), startOfTomorrow(now)),
  })
}

/** Saves how a task went, on the task and on its topic's schedule. */
export async function recordFreshOutcome(
  id: string,
  lessonId: string,
  o: Outcome,
  now = new Date(),
  database: GradientDB = db,
) {
  const result: DailyResult = !o.correct || o.gaveUp ? 'missed' : o.firstTry && o.hintsUsed === 0 ? 'clean' : 'assisted'
  await database.fresh.update(id, { result })
  await scheduleTopic(lessonId, o, now, database)
}

/** How to pitch the next task: a notch up after easy wins, a notch down after misses. */
export async function nextLevel(database: GradientDB = db): Promise<TaskLevel> {
  const recent = (await database.fresh.toArray())
    .filter((r) => r.result)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 4)
    .map((r) => r.result)
  const missed = recent.filter((r) => r === 'missed').length
  const clean = recent.filter((r) => r === 'clean').length
  if (missed >= 2) return 'easier'
  if (clean >= 3 && missed === 0) return 'harder'
  return 'medium'
}
