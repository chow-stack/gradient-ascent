import { afterEach, describe, expect, it } from 'vitest'
import { exportBackup, GradientDB, importBackup, resetProgress, type FeedbackRow } from '../../lib/db'
import { lessons } from '../content/content'
import { cardVariants } from '../content/schema'
import {
  addGeneralNote,
  cardSnapshot,
  cardVersion,
  describeAnswer,
  formatFeedback,
  markFeedbackDone,
  openFeedback,
  saveFeedback,
} from './feedback'

const dbs: GradientDB[] = []
const freshDb = () => {
  const d = new GradientDB(`test-${Math.random()}`)
  dbs.push(d)
  return d
}
afterEach(async () => {
  for (const d of dbs.splice(0)) await d.delete()
})

const at = new Date(2026, 10, 8, 10).getTime()
const flag = (over: Partial<FeedbackRow> = {}): FeedbackRow => ({
  kind: 'card',
  lessonId: 'p7-leakage',
  lessonTitle: 'Leakage',
  unit: 7,
  at,
  cardId: 'where-stats',
  cardType: 'choice',
  source: 'lesson',
  prompt: 'Where should the mean come from?',
  answer: 'All the data, before splitting',
  outcome: 'wrong',
  reason: 'wrong',
  ...over,
})

describe('feedback', () => {
  it('formats notes grouped by unit and lesson, with prompt, answer, reason and note', () => {
    const text = formatFeedback(
      [
        flag({ note: 'I think the misses note is off' }),
        { kind: 'lesson', lessonId: 'p1-print', lessonTitle: 'Print', unit: 1, at: at + 1, rating: 'easy' },
        flag({
          cardId: 'fix-standardise',
          cardType: 'fix',
          answer: 'def f():\n    pass\n',
          outcome: 'wrong',
          reason: 'confusing',
          version: 1,
        }),
      ],
      new Date(2026, 10, 8),
    )
    expect(text.indexOf('## Unit 1')).toBeLessThan(text.indexOf('## Unit 7'))
    expect(text).toContain('### Leakage (p7-leakage)')
    expect(text).toContain('- Card `where-stats` (choice, first pass, 8 Nov): Answer seems wrong')
    expect(text).toContain('  Prompt: Where should the mean come from?')
    expect(text).toContain('  My answer (wrong): All the data, before splitting')
    expect(text).toContain('  Note: I think the misses note is off')
    expect(text).toContain('- Lesson felt: Too easy')
    expect(text).toContain('(fix, variant 1, first pass, 8 Nov): Confusing')
    expect(text).toContain('    ```\n    def f():\n        pass\n    ```')
  })

  it('puts general notes first, apart from the units', async () => {
    const d = freshDb()
    await addGeneralNote('  The streak feels stressful\nmaybe hide it  ', d)
    await saveFeedback(flag(), undefined, d)
    const text = formatFeedback(await openFeedback(d))
    expect(text).toMatch(/## General\n\n- The streak feels stressful\n  maybe hide it \(\d+ \w+\)\n\n## Unit 7/)
  })

  it('gives nothing for no feedback', () => {
    expect(formatFeedback([])).toBe('')
  })

  it('updates a saved row, and marking done hides it', async () => {
    const d = freshDb()
    const id = await saveFeedback(flag(), undefined, d)
    await saveFeedback(flag({ reason: 'hard', note: 'tricky' }), id, d)
    expect(await openFeedback(d)).toMatchObject([{ id, reason: 'hard', note: 'tricky' }])
    await markFeedbackDone(d)
    expect(await openFeedback(d)).toEqual([])
    expect(await d.feedback.count()).toBe(1)
  })

  it('is kept in backups, and survives a progress reset', async () => {
    const d = freshDb()
    await saveFeedback(flag(), undefined, d)
    const backup = await exportBackup(d)
    expect(backup.tables.feedback).toHaveLength(1)
    await resetProgress(d)
    expect(await d.feedback.count()).toBe(1)

    const e = freshDb()
    await importBackup(JSON.parse(JSON.stringify(backup)), e)
    expect(await openFeedback(e)).toMatchObject([{ cardId: 'where-stats' }])
    // Backups from before feedback existed still restore.
    const { feedback: _, ...older } = backup.tables
    await importBackup({ ...backup, tables: older }, e)
    expect(await e.feedback.count()).toBe(0)
  })

  it('names the version of a card that is showing', () => {
    const lesson = lessons.find((l) => l.cards.some((c) => cardVariants(c).length))!
    const card = lesson.cards.find((c) => cardVariants(c).length)!
    expect(cardVersion(lesson, card)).toBe(0)
    expect(cardVersion(lesson, cardVariants(card)[0])).toBe(1)
    const plain = lesson.cards.find((c) => c.type === 'learn')!
    expect(cardVersion(lesson, plain)).toBeUndefined()
    expect(cardSnapshot(lesson, card)).toMatchObject({ lessonId: lesson.id, unit: lesson.unit, cardId: card.id })
  })

  it('describes answers as text', () => {
    expect(describeAnswer({ type: 'choice', choice: null })).toBeUndefined()
    expect(describeAnswer({ type: 'choice', choice: 'B' })).toBe('B')
    expect(describeAnswer({ type: 'blank', values: ['x', ''] })).toBe('x | (empty)')
    expect(describeAnswer({ type: 'code', code: '  ' })).toBeUndefined()
  })
})
