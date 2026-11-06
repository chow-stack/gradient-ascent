import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { dayKey, endOfDay, startOfTomorrow, type DayKey } from '../../lib/dates'
import { db, type DailyResult, type DayRow, type GradientDB, type MasteryRow } from '../../lib/db'
import { getItem } from '../content/content'
import { CHECKPOINT_PASS, REVIEWABLE, type CardType } from '../content/schema'
import { schedule, type FsrsCard } from '../review/fsrs'
import { selectDaily } from '../session/daily'
import { computeStreak, type StreakInfo } from './streak'
import {
  CHECKPOINT_PASS_BONUS,
  DAILY_COMPLETE_BONUS,
  LESSON_COMPLETE_BONUS,
  xpFor,
  type ItemSource,
  type Outcome,
} from './xp'

export type AttemptInput = {
  itemId: string
  lessonId: string
  type: CardType
  source: ItemSource
  outcome: Outcome
  durationMs: number
}

async function addToDay(database: GradientDB, day: DayKey, patch: { xp?: number; items?: number; ms?: number }) {
  const row: DayRow = (await database.days.get(day)) ?? { day, xp: 0, coreDone: false, items: 0, ms: 0 }
  row.xp += patch.xp ?? 0
  row.items += patch.items ?? 0
  row.ms += patch.ms ?? 0
  await database.days.put(row)
}

/**
 * Save one finished exercise: the attempt, today's totals, its spaced-repetition schedule,
 * and mastery (a correct review on a later day than the lesson was passed → mastered).
 * Returns the XP earned.
 */
export async function recordAttempt(a: AttemptInput, now = new Date(), database: GradientDB = db): Promise<number> {
  const day = dayKey(now)
  const xp = xpFor(a.type, a.source, a.outcome)

  // FSRS: lessons and checkpoints create the card the first time; reviews move it.
  // Practice/retries don't touch the schedule.
  let nextCard: FsrsCard | null = null
  const existing = await database.reviews.get(a.itemId)
  const firstSeen = (a.source === 'lesson' || a.source === 'checkpoint') && !existing
  if (REVIEWABLE.has(a.type) && (a.source === 'review' || firstSeen)) {
    nextCard = await schedule((existing?.card as FsrsCard | undefined) ?? null, a.outcome, now)
  }

  await database.transaction('rw', [database.attempts, database.days, database.reviews, database.mastery], async () => {
    await database.attempts.add({
      itemId: a.itemId,
      lessonId: a.lessonId,
      type: a.type,
      source: a.source,
      at: now.getTime(),
      day,
      ...a.outcome,
      durationMs: a.durationMs,
      xp,
    })
    await addToDay(database, day, { xp, items: 1, ms: a.durationMs })
    if (nextCard) {
      await database.reviews.put({
        itemId: a.itemId,
        lessonId: a.lessonId,
        // Sessions are daily: anything seen today (even a miss) comes back tomorrow at the earliest.
        due: Math.max(new Date(nextCard.dueAt).getTime(), startOfTomorrow(now)),
        card: nextCard,
      })
    }
    if (a.source === 'review' && a.outcome.correct && !a.outcome.gaveUp) {
      const m = await database.mastery.get(a.lessonId)
      if (m?.status === 'passed' && m.passedOn < day)
        await database.mastery.put({ ...m, status: 'mastered', masteredOn: day })
    }
  })
  return xp
}

/** Mark a lesson's ladder as done. Returns the bonus XP (0 if it was already passed). */
export async function completeLesson(lessonId: string, now = new Date(), database: GradientDB = db) {
  const existing = await database.mastery.get(lessonId)
  if (existing) return 0
  const day = dayKey(now)
  await database.mastery.put({ lessonId, status: 'passed', passedOn: day })
  await addToDay(database, day, { xp: LESSON_COMPLETE_BONUS })
  return LESSON_COMPLETE_BONUS
}

export type CheckpointResult = { passed: boolean; correct: number; total: number; needed: number; bonus: number }

/** Cards needed to pass a checkpoint of `total` cards. */
export const checkpointNeeded = (total: number) => Math.ceil(total * CHECKPOINT_PASS)

/**
 * Score a finished checkpoint. Passing marks it passed (which unlocks the next unit) and gives a bonus.
 * Failing changes nothing here: its cards are already in review, and it can be retaken tomorrow.
 */
export async function completeCheckpoint(
  lessonId: string,
  correct: number,
  total: number,
  now = new Date(),
  database: GradientDB = db,
): Promise<CheckpointResult> {
  const needed = checkpointNeeded(total)
  const passed = total > 0 && correct >= needed
  let bonus = 0
  if (passed && !(await database.mastery.get(lessonId))) {
    const day = dayKey(now)
    await database.mastery.put({ lessonId, status: 'passed', passedOn: day })
    await addToDay(database, day, { xp: CHECKPOINT_PASS_BONUS })
    bonus = CHECKPOINT_PASS_BONUS
  }
  return { passed, correct, total, needed, bonus }
}

/** Checkpoints tried today and not passed: they can be retaken tomorrow. */
export async function checkpointsToRetake(now = new Date(), database: GradientDB = db): Promise<Set<string>> {
  const tried = await database.attempts
    .where('day')
    .equals(dayKey(now))
    .filter((a) => a.source === 'checkpoint')
    .toArray()
  const ids = new Set(tried.map((a) => a.lessonId))
  for (const id of ids) if (await database.mastery.get(id)) ids.delete(id)
  return ids
}

const markDayDone = async (database: GradientDB, day: DayKey) => {
  await addToDay(database, day, {})
  await database.days.update(day, { coreDone: true })
}

export function dailyResult(o: Outcome): DailyResult {
  if (!o.correct || o.gaveUp) return 'missed'
  return o.firstTry && o.hintsUsed === 0 ? 'clean' : 'assisted'
}

/**
 * Save how one Daily 5 problem went, so leaving and coming back resumes the set.
 * The last answer finishes the set, even if the finish screen is never reached.
 */
export async function recordDailyResult(day: DayKey, itemId: string, result: DailyResult, database: GradientDB = db) {
  const row = await database.dailies.get(day)
  if (!row) return
  const results = { ...row.results, [itemId]: result }
  await database.dailies.update(day, { results })
  if (row.itemIds.every((id) => results[id] || !getItem(id))) await completeDaily(day, database)
}

/** Today's Daily 5 is finished: the day counts for the streak. Returns the bonus XP (0 if already finished). */
export async function completeDaily(day: DayKey, database: GradientDB = db): Promise<number> {
  const row = await database.dailies.get(day)
  if (!row || row.completedAt) return 0
  await database.dailies.update(day, { completedAt: Date.now() })
  await addToDay(database, day, { xp: DAILY_COMPLETE_BONUS })
  await markDayDone(database, day)
  return DAILY_COMPLETE_BONUS
}

/** On a day with nothing to review, finishing a lesson counts the day instead. */
export async function countDayIfNothingToReview(now = new Date(), database: GradientDB = db) {
  const day = dayKey(now)
  if (await database.dailies.get(day)) return
  if ((await selectDaily(now, database)).length === 0) await markDayDone(database, day)
}

// ---------- Reading progress (live) ----------

export type DailySnapshot = {
  /** Problems in today's set (0 = nothing to review today). */
  total: number
  /** One entry per problem, in order; null = not answered yet. */
  results: (DailyResult | null)[]
  done: boolean
}

export type ProgressSnapshot = {
  streak: StreakInfo
  daily: DailySnapshot
  /** Days that count for the streak. */
  doneDays: Set<DayKey>
  totalXp: number
  today: DayRow | null
  dueCount: number
  reviewCount: number
  mastery: Map<string, MasteryRow>
  /** Checkpoints failed today; they unlock again tomorrow. */
  retakeTomorrow: Set<string>
}

export async function loadProgress(now = new Date(), database: GradientDB = db): Promise<ProgressSnapshot> {
  const [days, dueCount, reviewCount, mastery, retakeTomorrow, dailyRow, candidates] = await Promise.all([
    database.days.toArray(),
    database.reviews.where('due').belowOrEqual(endOfDay(now)).count(),
    database.reviews.count(),
    database.mastery.toArray(),
    checkpointsToRetake(now, database),
    database.dailies.get(dayKey(now)),
    selectDaily(now, database),
  ])
  const itemIds = dailyRow?.itemIds ?? candidates
  const today = dayKey(now)
  const doneDays = new Set(days.filter((d) => d.coreDone).map((d) => d.day))
  return {
    streak: computeStreak(doneDays, today),
    daily: {
      total: itemIds.length,
      results: itemIds.map((id) => dailyRow?.results[id] ?? null),
      done: !!dailyRow?.completedAt,
    },
    doneDays,
    totalXp: days.reduce((s, d) => s + d.xp, 0),
    today: days.find((d) => d.day === today) ?? null,
    dueCount,
    reviewCount,
    mastery: new Map(mastery.map((m) => [m.lessonId, m])),
    retakeTomorrow,
  }
}

/** Subscribes to the database and re-renders when progress changes. `null` while loading. */
export function useProgress(): ProgressSnapshot | null {
  const [snap, setSnap] = useState<ProgressSnapshot | null>(null)
  useEffect(() => {
    const sub = liveQuery(() => loadProgress()).subscribe({ next: setSnap, error: console.error })
    return () => sub.unsubscribe()
  }, [])
  return snap
}
