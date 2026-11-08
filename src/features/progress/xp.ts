import type { CardType } from '../content/schema'

export type ItemSource = 'lesson' | 'checkpoint' | 'project' | 'review' | 'practice' | 'retry'

/** Harder rungs of the ladder are worth more (BUILD_PLAN P10: gamify the habit, not the grind). */
const BASE: Record<CardType, number> = {
  learn: 2,
  choice: 5,
  parsons: 8,
  blank: 8,
  fix: 12,
  write: 15,
  explain: 8,
  project: 40,
}

const SOURCE_FACTOR: Record<ItemSource, number> = {
  lesson: 1,
  checkpoint: 1,
  project: 1,
  review: 0.7,
  practice: 0.3,
  retry: 0.3,
}

export const LESSON_COMPLETE_BONUS = 20
export const CHECKPOINT_PASS_BONUS = 50
export const DAILY_COMPLETE_BONUS = 15

export type Outcome = { correct: boolean; firstTry: boolean; hintsUsed: number; gaveUp: boolean }

export function xpFor(type: CardType, source: ItemSource, o: Outcome): number {
  if (type === 'learn') return Math.round(BASE.learn * SOURCE_FACTOR[source])
  if (!o.correct || o.gaveUp) return 0
  let xp = BASE[type]
  if (o.firstTry && o.hintsUsed === 0) xp *= 1.5
  xp *= Math.max(0.25, 1 - 0.25 * o.hintsUsed)
  xp *= SOURCE_FACTOR[source]
  return Math.max(1, Math.round(xp))
}
