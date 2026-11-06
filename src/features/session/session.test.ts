import { afterEach, describe, expect, it } from 'vitest'
import { exportBackup, GradientDB, importBackup } from '../../lib/db'
import { lessons } from '../content/content'
import { parseLesson, versionForReview } from '../content/schema'
import {
  completeDaily,
  completeLesson,
  countDayIfNothingToReview,
  loadProgress,
  recordAttempt,
  recordDailyResult,
} from '../progress/progress'
import { dayKey } from '../../lib/dates'
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
async function playAll(db: GradientDB, kind: 'lesson' | 'daily', now: Date) {
  const plan = await buildSession(kind, {}, now, db)
  for (const it of plan.items) {
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
    if (plan.daily) await recordDailyResult(plan.daily.day, it.itemId, 'clean', db)
  }
  if (plan.lessonId) {
    await completeLesson(plan.lessonId, now, db)
    await countDayIfNothingToReview(now, db)
  }
  if (plan.daily) await completeDaily(plan.daily.day, db)
  return plan
}

describe('content', () => {
  it('loads every lesson in path order', () => {
    expect(lessons.length).toBeGreaterThanOrEqual(10)
    expect(lessons[0].id).toBe('p1-program')
    const positions = lessons.map((l) => l.unit * 100 + l.order)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })
})

describe('daily loop', () => {
  it('starts with the first lesson; nothing to review yet', async () => {
    const db = freshDb()
    expect((await buildSession('daily', {}, day1, db)).items).toHaveLength(0)
    const plan = await buildSession('lesson', {}, day1, db)
    expect(plan.lessonId).toBe('p1-program')
    expect(plan.items.every((i) => i.source === 'lesson')).toBe(true)
  })

  it('on a day with nothing to review, a lesson passes, counts the day and schedules reviews', async () => {
    const db = freshDb()
    await playAll(db, 'lesson', day1)
    const p = await loadProgress(day1, db)
    expect(p.mastery.get('p1-program')?.status).toBe('passed')
    expect(p.streak).toMatchObject({ current: 1, todayDone: true })
    expect(p.totalXp).toBeGreaterThan(0)
    expect(p.reviewCount).toBeGreaterThan(0)
    expect(p.dueCount).toBe(0) // nothing due the same day
    expect(p.daily.total).toBe(0) // and nothing in today's set
    expect(nextLesson(p.mastery)?.id).toBe('p1-errors')
  })

  it('brings problems back later, then masters the lesson on a correct review', async () => {
    const db = freshDb()
    await playAll(db, 'lesson', day1)
    const plan = await playAll(db, 'daily', day8)
    expect(plan.items.length).toBeGreaterThan(0)
    expect(plan.items.length).toBeLessThanOrEqual(5)
    expect(plan.items.every((i) => i.source === 'review')).toBe(true)
    const p = await loadProgress(day8, db)
    expect(p.mastery.get('p1-program')?.status).toBe('mastered')
    expect(p.daily.done).toBe(true)
  })

  it('a missed review comes back sooner than a correct one', async () => {
    const db = freshDb()
    await playAll(db, 'lesson', day1)
    const [a, b] = await db.reviews.toArray()
    const base = { lessonId: a.lessonId, type: 'choice' as const, source: 'review' as const, durationMs: 1 }
    await recordAttempt({ ...base, itemId: a.itemId, outcome: { ...ok, correct: false } }, day8, db)
    await recordAttempt({ ...base, itemId: b.itemId, outcome: ok }, day8, db)
    const [a2, b2] = await Promise.all([db.reviews.get(a.itemId), db.reviews.get(b.itemId)])
    expect(a2!.due).toBeLessThan(b2!.due)
  })

  it('round-trips a backup', async () => {
    const db = freshDb()
    await playAll(db, 'lesson', day1)
    const backup = JSON.parse(JSON.stringify(await exportBackup(db)))
    const other = freshDb()
    await importBackup(backup, other)
    expect(await other.attempts.count()).toBe(await db.attempts.count())
    // FSRS dates survive JSON and still schedule.
    const r = await other.reviews.toArray()
    expect((r[0].card as { dueAt: unknown }).dueAt).toBeInstanceOf(Date)
    const plan = await buildSession('daily', {}, day8, other)
    expect(plan.items.some((i) => i.source === 'review')).toBe(true)
  })

  it('rejects files that are not backups', async () => {
    await expect(importBackup({ hello: 1 }, freshDb())).rejects.toThrow(/not a Gradient Ascent backup/)
  })
})

describe('same-day behavior', () => {
  it('a problem enters the pool the day after it is first seen, even after a miss', async () => {
    const db = freshDb()
    const plan = await buildSession('lesson', {}, day1, db)
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
    expect((await buildSession('daily', {}, day1, db)).items).toHaveLength(0)
    const tomorrow = await buildSession('daily', {}, new Date(2026, 10, 5, 9), db)
    expect(tomorrow.items.some((i) => i.itemId === first.itemId && i.source === 'review')).toBe(true)
  })
})

describe('daily 5', () => {
  /** Pass Unit 1's lessons and see every card, so the pool is large. */
  async function fillPool(db: GradientDB) {
    for (const l of lessons.filter((l) => l.unit === 1 && l.kind === 'lesson').slice(0, 5)) {
      for (const card of l.cards) {
        await recordAttempt(
          {
            itemId: `${l.id}/${card.id}`,
            lessonId: l.id,
            type: card.type,
            source: 'lesson',
            outcome: ok,
            durationMs: 1,
          },
          day1,
          db,
        )
      }
      await completeLesson(l.id, day1, db)
    }
  }

  it('stays at 5 however large the pool is, with at most 2 code problems, placed last', async () => {
    const db = freshDb()
    await fillPool(db)
    expect(await db.reviews.count()).toBeGreaterThan(5)
    const plan = await buildSession('daily', {}, day8, db)
    expect(plan.items).toHaveLength(5)
    const code = plan.items.map((i) => i.card.type === 'fix' || i.card.type === 'write')
    expect(code.filter(Boolean).length).toBeLessThanOrEqual(2)
    expect(code.indexOf(true) === -1 || code.slice(code.indexOf(true)).every(Boolean)).toBe(true)
  })

  it('is the same set all day, and leaving resumes where you stopped', async () => {
    const db = freshDb()
    await fillPool(db)
    const first = await buildSession('daily', {}, day8, db)
    const again = await buildSession('daily', {}, day8, db)
    expect(again.daily?.itemIds).toEqual(first.daily?.itemIds)

    await recordDailyResult(dayKey(day8), first.items[0].itemId, 'clean', db)
    const resumed = await buildSession('daily', {}, day8, db)
    expect(resumed.items.map((i) => i.itemId)).toEqual(first.items.slice(1).map((i) => i.itemId))
    expect((await loadProgress(day8, db)).daily.results.filter(Boolean)).toHaveLength(1)
  })

  it('the last answer finishes the set, even if the finish screen is never reached', async () => {
    const db = freshDb()
    await fillPool(db)
    const { daily } = await buildSession('daily', {}, day8, db)
    for (const id of daily!.itemIds) await recordDailyResult(daily!.day, id, 'clean', db)
    const p = await loadProgress(day8, db)
    expect(p.daily.done).toBe(true)
    expect(p.streak.todayDone).toBe(true)
  })

  it('finishing counts the day once; a lesson does not when a set is waiting', async () => {
    const db = freshDb()
    await fillPool(db)
    const plan = await buildSession('daily', {}, day8, db)
    await countDayIfNothingToReview(day8, db)
    expect((await loadProgress(day8, db)).streak.todayDone).toBe(false)
    expect(await completeDaily(plan.daily!.day, db)).toBeGreaterThan(0)
    expect(await completeDaily(plan.daily!.day, db)).toBe(0)
  })
})

describe('card variants', () => {
  const lesson = (extra: string) =>
    `id: x\ntrack: ml\nunit: 1\norder: 1\ntitle: T\nsummary: S\ncards:\n  - type: choice\n    id: c\n    prompt: P\n    choices: ['a', 'b']\n    answer: 'a'\n    why: W\n${extra}`

  it('reviews cycle through versions, starting with a new one', () => {
    const card = parseLesson(lesson(`    variants:\n      - { prompt: Q }\n      - { prompt: R }\n`), 'v.yaml').cards[0]
    const prompts = [0, 1, 2, 3].map((n) => (versionForReview(card, n) as { prompt: string }).prompt)
    expect(prompts).toEqual(['Q', 'R', 'P', 'Q'])
  })

  it('a card without variants always shows itself', () => {
    const card = parseLesson(lesson(''), 'v.yaml').cards[0]
    expect(versionForReview(card, 3)).toBe(card)
  })

  it('rejects a variant whose answer is not a choice', () => {
    expect(() => parseLesson(lesson(`    variants:\n      - { answer: z }\n`), 'v.yaml')).toThrow(/variant/)
  })
})

describe('practice mode', () => {
  it('moves each card to its next version every round', async () => {
    const database = freshDb()
    const practice = () => buildSession('practice', { lessonId: 'a1-strings' }, day1, database)
    // A practice round samples the lesson's cards, so keep building until this one is in it.
    const slice = async () => {
      for (;;) {
        const found = (await practice()).items.find((i) => i.card.id === 'slice')
        if (found) return found
      }
    }
    const base = lessons.find((l) => l.id === 'a1-strings')!.cards.find((c) => c.id === 'slice')!
    const first = await slice()
    expect(first.card).toEqual(versionForReview(base, 0))
    expect(first.card).not.toEqual(base)
    await recordAttempt(
      { itemId: first.itemId, lessonId: 'a1-strings', type: 'choice', source: 'practice', outcome: ok, durationMs: 1 },
      day1,
      database,
    )
    expect((await slice()).card).toEqual(versionForReview(base, 1))
  })
})
