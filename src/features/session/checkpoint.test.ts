import { afterEach, describe, expect, it } from 'vitest'
import { GradientDB } from '../../lib/db'
import { lessons } from '../content/content'
import { isCheckpoint, parseLesson } from '../content/schema'
import { checkpointNeeded, completeCheckpoint, completeLesson, loadProgress, recordAttempt } from '../progress/progress'
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

const day1 = new Date(2026, 10, 4, 10)
const day2 = new Date(2026, 10, 5, 10)
const unit1 = lessons.filter((l) => l.track === 'foundations' && l.unit === 1)
const checkpoint = unit1.find(isCheckpoint)!

/** Pass every Unit 1 lesson so the checkpoint is next. */
async function passLessons(db: GradientDB) {
  for (const l of unit1.filter((l) => !isCheckpoint(l))) await completeLesson(l.id, day1, db)
}

/** Answer the checkpoint, getting `right` cards correct, and score it. */
async function takeCheckpoint(db: GradientDB, right: number, now: Date) {
  const plan = await buildSession('lesson', {}, now, db)
  for (const [i, it] of plan.items.entries())
    await recordAttempt(
      {
        itemId: it.itemId,
        lessonId: it.lesson.id,
        type: it.card.type,
        source: it.source,
        outcome: { correct: i < right, firstTry: true, hintsUsed: 0, gaveUp: false },
        durationMs: 1,
      },
      now,
      db,
    )
  return completeCheckpoint(plan.lessonId!, Math.min(right, plan.items.length), plan.items.length, now, db)
}

describe('unit checkpoint', () => {
  it('ends Unit 1 and comes right after its last lesson', () => {
    expect(checkpoint).toBeDefined()
    expect(unit1.at(-1)?.id).toBe(checkpoint.id)
  })

  it('is next once every lesson in the unit is passed, with checkpoint items', async () => {
    const db = freshDb()
    await passLessons(db)
    const p = await loadProgress(day1, db)
    expect(nextLesson(p.mastery)?.id).toBe(checkpoint.id)
    const plan = await buildSession('lesson', {}, day1, db)
    expect(plan.items.length).toBe(checkpoint.cards.length)
    expect(plan.items.every((i) => i.source === 'checkpoint')).toBe(true)
  })

  it('passing at 80% marks it passed and gives a bonus', async () => {
    const db = freshDb()
    await passLessons(db)
    const r = await takeCheckpoint(db, checkpointNeeded(checkpoint.cards.length), day1)
    expect(r).toMatchObject({ passed: true })
    expect(r.bonus).toBeGreaterThan(0)
    const p = await loadProgress(day1, db)
    expect(p.mastery.get(checkpoint.id)?.status).toBe('passed')
    expect(p.retakeTomorrow.size).toBe(0)
  })

  it('failing puts its cards in review and locks it until tomorrow', async () => {
    const db = freshDb()
    await passLessons(db)
    const r = await takeCheckpoint(db, checkpointNeeded(checkpoint.cards.length) - 1, day1)
    expect(r.passed).toBe(false)
    const p = await loadProgress(day1, db)
    expect(p.mastery.has(checkpoint.id)).toBe(false)
    expect(p.retakeTomorrow.has(checkpoint.id)).toBe(true)
    expect(nextLesson(p.mastery, p.retakeTomorrow)).toBeUndefined()
    expect((await buildSession('lesson', {}, day1, db)).items).toHaveLength(0)
    expect(await db.reviews.where('lessonId').equals(checkpoint.id).count()).toBeGreaterThan(0)

    const tomorrow = await buildSession('core', {}, day2, db)
    expect(tomorrow.lessonId).toBe(checkpoint.id)
    expect(tomorrow.items.some((i) => i.source === 'review' && i.lesson.id === checkpoint.id)).toBe(true)
  })
})

describe('checkpoint schema', () => {
  const base = `id: x\ntrack: foundations\nunit: 1\norder: 1\nkind: checkpoint\ntitle: T\nsummary: S\ncards:\n`
  const choice = (n: number, extra = '') =>
    `  - { type: choice, id: c${n}, prompt: P, choices: ['a', 'b'], answer: 'a', why: W${extra} }\n`

  it('needs enough cards, and no hints or teaching cards', () => {
    const eight = Array.from({ length: 8 }, (_, i) => choice(i)).join('')
    expect(() => parseLesson(base + eight, 'ok.yaml')).not.toThrow()
    expect(() => parseLesson(base + choice(1), 'few.yaml')).toThrow(/at least 8/)
    expect(() => parseLesson(base + eight + choice(9, ", hints: ['h']"), 'hint.yaml')).toThrow(/no hints/)
    expect(() => parseLesson(base + eight + '  - { type: learn, id: l, title: T, body: B }\n', 'learn.yaml')).toThrow(
      /don't belong/,
    )
  })
})
