import { DefaultScheduler, Rating } from 'ts-fsrs'
import type { Outcome } from '../progress/xp'

/**
 * FSRS spaced repetition (ts-fsrs). Intervals are whole days: sessions are daily, so no
 * minute-level learning steps. Target retention 90%. A miss (Again) is due again right away,
 * which in practice means the next session.
 */
type Scheduler = Awaited<ReturnType<typeof DefaultScheduler>>
/** The stored card (includes `dueAt`). ts-fsrs 6's review() output type omits `stabilityFast`
 * although the runtime card has it, so cards are typed as review() *input* and cast once below. */
export type FsrsCard = Parameters<Scheduler['review']>[0]['card']

let scheduler: Promise<Scheduler> | null = null
export function getScheduler(): Promise<Scheduler> {
  scheduler ??= DefaultScheduler({ desiredRetention: 0.9, enableShortTerm: false, enableFuzz: true })
  return scheduler
}

/** Map how an attempt went to an FSRS grade. We never guess "Easy"; Good is the ceiling. */
export function gradeFor(o: Outcome) {
  if (!o.correct || o.gaveUp) return Rating.Again
  if (o.firstTry && o.hintsUsed === 0) return Rating.Good
  return Rating.Hard
}

/** Review (or first-time schedule, when `card` is null) and return the next card state. */
export async function schedule(card: FsrsCard | null, o: Outcome, now = new Date()): Promise<FsrsCard> {
  const s = await getScheduler()
  const current = card ?? (s.newCard({ now }) as unknown as FsrsCard)
  const review = s.review.bind(s) as unknown as (args: {
    card: FsrsCard
    grade: ReturnType<typeof gradeFor>
    now: Date
  }) => { card: FsrsCard }
  return review({ card: current, grade: gradeFor(o), now }).card
}
