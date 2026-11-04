import { afterEach, describe, expect, it } from 'vitest'
import { exportBackup, GradientDB, importBackup } from '../../lib/db'
import { lessons } from '../content/content'
import { completeCoreSession, completeLesson, loadProgress, recordAttempt } from '../progress/progress'
import { buildSession, nextLesson } from './plan'

const dbs: GradientDB[] = []
const freshDb = () => {
  const d = new GradientDB(`test-${Math.random()}`)
  dbs.push(d)
  return d
}
afterEach(async () => {
  for (const d of dbs.splice(0)) await d.delete()
})

const ok = { correct: true, firstTry: true, hintsUsed: 0, gaveUp: false }
const day1 = new Date(2026, 10, 4, 10)
const day8 = new Date(2026, 10, 11, 10)

/** Play every item of a plan, answering everything right. */
async function playAll(db: GradientDB, kind: 'core' | 'review', now: Date) {
  const plan = await buildSession(kind, {}, now, db)
  for (const it of plan.items)
    await recordAttempt(
      {
        itemId: it.itemId,
        lessonId: it.lesson.id,
        type: it.card.type,
        source: it.source,
        outcome: ok,
        durationMs: 1000,
      },
      now,
      db,
    )
  if (plan.lessonId) await completeLesson(plan.lessonId, now, db)
  if (kind === 'core') await completeCoreSession(now, db)
  return plan
}

describe('content', () => {
  it('loads every lesson in path order', () => {
    expect(lessons.length).toBeGreaterThanOrEqual(10)
    expect(lessons[0].id).toBe('a1-variables')
    expect(lessons.map((l) => l.order)).toEqual([...lessons.map((l) => l.order)].sort((a, b) => a - b))
  })
})

describe('daily loop', () => {
  it('starts with the first lesson and no reviews', async () => {
    const db = freshDb()
    const plan = await buildSession('core', {}, day1, db)
    expect(plan.lessonId).toBe('a1-variables')
    expect(plan.items.every((i) => i.source === 'lesson')).toBe(true)
  })

  it('finishing a core session passes the lesson, counts the day and schedules reviews', async () => {
    const db = freshDb()
    await playAll(db, 'core', day1)
    const p = await loadProgress(day1, db)
    expect(p.mastery.get('a1-variables')?.status).toBe('passed')
    expect(p.streak).toMatchObject({ current: 1, todayDone: true })
    expect(p.totalXp).toBeGreaterThan(0)
    expect(p.reviewCount).toBeGreaterThan(0)
    expect(p.dueCount).toBe(0) // nothing due the same day
    expect(nextLesson(p.mastery)?.id).toBe('a1-numbers')
  })

  it('brings reviews back later, then masters the lesson on a correct review', async () => {
    const db = freshDb()
    await playAll(db, 'core', day1)
    const plan = await playAll(db, 'core', day8)
    const reviews = plan.items.filter((i) => i.source === 'review')
    expect(reviews.length).toBeGreaterThan(0)
    expect(reviews.length).toBeLessThanOrEqual(5)
    expect(plan.lessonId).toBe('a1-numbers')
    const p = await loadProgress(day8, db)
    expect(p.mastery.get('a1-variables')?.status).toBe('mastered')
  })

  it('a missed review comes back sooner than a correct one', async () => {
    const db = freshDb()
    await playAll(db, 'core', day1)
    const [a, b] = await db.reviews.toArray()
    const base = { lessonId: a.lessonId, type: 'choice' as const, source: 'review' as const, durationMs: 1 }
    await recordAttempt({ ...base, itemId: a.itemId, outcome: { ...ok, correct: false } }, day8, db)
    await recordAttempt({ ...base, itemId: b.itemId, outcome: ok }, day8, db)
    const [a2, b2] = await Promise.all([db.reviews.get(a.itemId), db.reviews.get(b.itemId)])
    expect(a2!.due).toBeLessThan(b2!.due)
  })

  it('round-trips a backup', async () => {
    const db = freshDb()
    await playAll(db, 'core', day1)
    const backup = JSON.parse(JSON.stringify(await exportBackup(db)))
    const other = freshDb()
    await importBackup(backup, other)
    expect(await other.attempts.count()).toBe(await db.attempts.count())
    // FSRS dates survive JSON and still schedule.
    const r = await other.reviews.toArray()
    expect((r[0].card as { dueAt: unknown }).dueAt).toBeInstanceOf(Date)
    const plan = await buildSession('core', {}, day8, other)
    expect(plan.items.some((i) => i.source === 'review')).toBe(true)
  })

  it('rejects files that are not backups', async () => {
    await expect(importBackup({ hello: 1 }, freshDb())).rejects.toThrow(/not a Gradient Ascent backup/)
  })
})

describe('same-day behavior', () => {
  it('a miss in today’s lesson is not due again until tomorrow', async () => {
    const db = freshDb()
    const plan = await buildSession('core', {}, day1, db)
    const first = plan.items.find((i) => i.card.type === 'choice')!
    await recordAttempt(
      {
        itemId: first.itemId,
        lessonId: first.lesson.id,
        type: 'choice',
        source: 'lesson',
        outcome: { ...ok, correct: false },
        durationMs: 1,
      },
      day1,
      db,
    )
    const again = await buildSession('core', {}, day1, db)
    expect(again.items.some((i) => i.source === 'review')).toBe(false)
    const tomorrow = await buildSession('core', {}, new Date(2026, 10, 5, 9), db)
    expect(tomorrow.items.some((i) => i.itemId === first.itemId && i.source === 'review')).toBe(true)
  })
})
