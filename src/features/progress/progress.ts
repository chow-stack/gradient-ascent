import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { dayKey, endOfDay, startOfTomorrow, type DayKey } from '../../lib/dates'
import { db, type DayRow, type GradientDB, type MasteryRow } from '../../lib/db'
import { REVIEWABLE, type CardType } from '../content/schema'
import { schedule, type FsrsCard } from '../review/fsrs'
import { computeStreak, type StreakInfo } from './streak'
import { LESSON_COMPLETE_BONUS, xpFor, type ItemSource, type Outcome } from './xp'

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

  // FSRS: lessons create the card the first time; reviews move it. Practice/retries don't touch the schedule.
  let nextCard: FsrsCard | null = null
  const existing = await database.reviews.get(a.itemId)
  if (REVIEWABLE.has(a.type) && (a.source === 'review' || (a.source === 'lesson' && !existing))) {
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

/** The day's core session is done → the day counts for the streak. */
export async function completeCoreSession(now = new Date(), database: GradientDB = db) {
  const day = dayKey(now)
  await addToDay(database, day, {})
  await database.days.update(day, { coreDone: true })
}

// ---------- Reading progress (live) ----------

export type ProgressSnapshot = {
  streak: StreakInfo
  /** Days whose core session was finished. */
  doneDays: Set<DayKey>
  totalXp: number
  today: DayRow | null
  dueCount: number
  reviewCount: number
  mastery: Map<string, MasteryRow>
}

export async function loadProgress(now = new Date(), database: GradientDB = db): Promise<ProgressSnapshot> {
  const [days, dueCount, reviewCount, mastery] = await Promise.all([
    database.days.toArray(),
    database.reviews.where('due').belowOrEqual(endOfDay(now)).count(),
    database.reviews.count(),
    database.mastery.toArray(),
  ])
  const today = dayKey(now)
  const doneDays = new Set(days.filter((d) => d.coreDone).map((d) => d.day))
  return {
    streak: computeStreak(doneDays, today),
    doneDays,
    totalXp: days.reduce((s, d) => s + d.xp, 0),
    today: days.find((d) => d.day === today) ?? null,
    dueCount,
    reviewCount,
    mastery: new Map(mastery.map((m) => [m.lessonId, m])),
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
