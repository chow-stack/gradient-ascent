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
const unit1 = lessons.filter((l) => l.unit === 1)
const checkpoint = unit1.find(isCheckpoint)!

/** Pass every Unit 1 lesson so the checkpoint is next. */
async function passLessons(db: GradientDB) {
  for (const l of unit1.filter((l) => l.kind === 'lesson')) await completeLesson(l.id, day1, db)
}

/** Answer the checkpoint, getting `right(total)` questions correct, and score it. */
async function takeCheckpoint(db: GradientDB, rightOf: (total: number) => number, now: Date) {
  const plan = await buildSession('lesson', {}, now, db)
  const right = rightOf(plan.items.length)
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
  it('comes right after the last lesson of Unit 1', () => {
    expect(checkpoint).toBeDefined()
    expect(unit1.findLast((l) => l.kind !== 'project')?.id).toBe(checkpoint.id)
  })

  it('is next once every lesson in the unit is passed, with checkpoint items', async () => {
    const db = freshDb()
    await passLessons(db)
    const p = await loadProgress(day1, db)
    expect(nextLesson(p.mastery)?.id).toBe(checkpoint.id)
    const plan = await buildSession('lesson', {}, day1, db)
    // Its own questions, plus a few from the unit's lessons.
    expect(plan.items.length).toBe(checkpoint.cards.length + 4)
    expect(plan.items.filter((i) => i.lesson.id === checkpoint.id)).toHaveLength(checkpoint.cards.length)
    expect(plan.items.every((i) => i.source === 'checkpoint')).toBe(true)
  })

  it('passing at 80% marks it passed and gives a bonus', async () => {
    const db = freshDb()
    await passLessons(db)
    const r = await takeCheckpoint(db, checkpointNeeded, day1)
    expect(r).toMatchObject({ passed: true })
    expect(r.bonus).toBeGreaterThan(0)
    const p = await loadProgress(day1, db)
    expect(p.mastery.get(checkpoint.id)?.status).toBe('passed')
  })

  it('failing puts its cards in review, and it can be retaken straight away in new versions', async () => {
    const db = freshDb()
    await passLessons(db)
    const r = await takeCheckpoint(db, (total) => checkpointNeeded(total) - 1, day1)
    expect(r.passed).toBe(false)
    const p = await loadProgress(day1, db)
    expect(p.mastery.has(checkpoint.id)).toBe(false)
    expect(await db.reviews.where('lessonId').equals(checkpoint.id).count()).toBeGreaterThan(0)

    const retake = await buildSession('lesson', {}, day1, db)
    expect(retake.lessonId).toBe(checkpoint.id)
    const own = retake.items.filter((i) => i.lesson.id === checkpoint.id)
    const withVariants = checkpoint.cards.filter((c) => 'variants' in c && c.variants.length > 0)
    expect(own.filter((i) => i.version === 1)).toHaveLength(withVariants.length)
    const daily = await buildSession('daily', {}, day2, db)
    expect(daily.items.some((i) => i.source === 'review' && i.lesson.id === checkpoint.id)).toBe(true)
  })
})

describe('checkpoint schema', () => {
  const base = `id: x\ntrack: ml\nunit: 1\norder: 1\nkind: checkpoint\ntitle: T\nsummary: S\ncards:\n`
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
