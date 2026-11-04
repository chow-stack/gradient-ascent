import { describe, expect, it } from 'vitest'
import { xpFor } from './xp'

const clean = { correct: true, firstTry: true, hintsUsed: 0, gaveUp: false }

describe('xpFor', () => {
  it('rewards harder rungs more', () => {
    expect(xpFor('write', 'lesson', clean)).toBeGreaterThan(xpFor('fix', 'lesson', clean))
    expect(xpFor('fix', 'lesson', clean)).toBeGreaterThan(xpFor('choice', 'lesson', clean))
  })

  it('gives a first-try bonus and reduces XP for hints', () => {
    const retry = xpFor('write', 'lesson', { ...clean, firstTry: false })
    expect(xpFor('write', 'lesson', clean)).toBeGreaterThan(retry)
    expect(xpFor('write', 'lesson', { ...clean, firstTry: false, hintsUsed: 2 })).toBeLessThan(retry)
  })

  it('gives nothing for wrong answers or give-ups', () => {
    expect(xpFor('write', 'lesson', { ...clean, correct: false })).toBe(0)
    expect(xpFor('write', 'lesson', { ...clean, gaveUp: true })).toBe(0)
  })

  it('makes repeats worth less than new work', () => {
    expect(xpFor('fix', 'practice', clean)).toBeLessThan(xpFor('fix', 'review', clean))
    expect(xpFor('fix', 'review', clean)).toBeLessThan(xpFor('fix', 'lesson', clean))
  })
})
