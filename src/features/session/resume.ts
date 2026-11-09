import type { Answer } from '../exercises/grading'

/**
 * Where a lesson, checkpoint or project was left, kept in this browser so leaving mid-way and coming back picks up
 * at the same card. Lesson answers are already saved as they happen; this keeps the place, the running totals, and a
 * checkpoint's ungraded answers.
 */
const PREFIX = 'ga.resume.'

export type Resume = {
  /** The session's cards, in order, by item id and version (0 is the card itself). */
  items: { itemId: string; version: number }[]
  /** The first card not yet finished. */
  idx: number
  /** Keys of the items that came back for one more try, in the order they were added. */
  retried: string[]
  totals: { xp: number; correct: number; graded: number }
  checkpoint: { correct: number; total: number }
  /** Each finished test question, for the results screen. */
  results: { key: string; correct: boolean }[]
  /** A checkpoint's answers so far, by item key. They're only graded when the checkpoint is submitted. */
  answers?: Record<string, Answer>
}

export function loadResume(lessonId: string): Resume | null {
  try {
    const raw = localStorage.getItem(PREFIX + lessonId)
    return raw ? (JSON.parse(raw) as Resume) : null
  } catch {
    return null
  }
}

export function saveResume(lessonId: string, r: Resume) {
  try {
    localStorage.setItem(PREFIX + lessonId, JSON.stringify(r))
  } catch {
    // Storage can be full or blocked; the lesson just starts from the top next time.
  }
}

export function clearResume(lessonId: string) {
  try {
    localStorage.removeItem(PREFIX + lessonId)
  } catch {
    // nothing to clear
  }
}
