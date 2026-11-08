import { describe, expect, it } from 'vitest'
import { cardVariants, lessonSchema } from './schema'

const lesson = (card: Record<string, unknown>) => ({
  id: 'l',
  track: 'ml',
  unit: 1,
  order: 1,
  title: 'T',
  summary: 'S',
  cards: [{ type: 'choice', id: 'c', prompt: 'P', choices: ['a', 'b', 'c'], answer: 'a', why: 'W', ...card }],
})

const problems = (card: Record<string, unknown>) => {
  const r = lessonSchema.safeParse(lesson(card))
  return r.success ? [] : r.error.issues.map((i) => i.message)
}

describe('notes for wrong choices', () => {
  it('accepts a note for any wrong choice', () => {
    expect(problems({ misses: { b: 'You did X.' } })).toEqual([])
  })

  it('rejects a note for something that is not a choice, or for the answer', () => {
    expect(problems({ misses: { d: 'Nope.' } })).toEqual(['c: misses has a note for "d", which isn\'t a choice'])
    expect(problems({ misses: { a: 'Nope.' } })).toEqual(['c: misses is for wrong choices, not the answer'])
  })

  it("doesn't pass them to a variant with new choices, which can give its own", () => {
    const r = lessonSchema.parse(
      lesson({
        misses: { b: 'Note for b.' },
        variants: [
          { prompt: 'Same choices' },
          { choices: ['x', 'y'], answer: 'x' },
          { choices: ['x', 'y'], answer: 'x', misses: { y: 'Note for y.' } },
        ],
      }),
    )
    const [same, fresh, own] = cardVariants(r.cards[0])
    expect(same.type === 'choice' && same.misses).toEqual({ b: 'Note for b.' })
    expect(fresh.type === 'choice' && fresh.misses).toEqual({})
    expect(own.type === 'choice' && own.misses).toEqual({ y: 'Note for y.' })
  })

  it('checks the notes in variants too', () => {
    expect(problems({ variants: [{ choices: ['x', 'y'], answer: 'x', misses: { z: 'Nope.' } }] })).toEqual([
      'c: variant: misses has a note for "z", which isn\'t a choice',
    ])
  })
})
