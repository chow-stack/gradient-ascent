import { describe, expect, it } from 'vitest'
import { computeStreak } from './streak'

// 2026-11-04 is a Wednesday; that week starts Monday 2026-11-02.
describe('computeStreak', () => {
  it('is zero with no history', () => {
    expect(computeStreak([], '2026-11-04')).toMatchObject({ current: 0, todayDone: false, freezesLeft: 2 })
  })

  it('counts consecutive days including today', () => {
    const s = computeStreak(['2026-11-02', '2026-11-03', '2026-11-04'], '2026-11-04')
    expect(s).toMatchObject({ current: 3, todayDone: true, frozenDays: [] })
  })

  it('keeps yesterday’s streak alive before today is done', () => {
    expect(computeStreak(['2026-11-02', '2026-11-03'], '2026-11-04').current).toBe(2)
  })

  it('uses a freeze for a missed day and reports it', () => {
    const s = computeStreak(['2026-11-02', '2026-11-04'], '2026-11-04')
    expect(s.current).toBe(2)
    expect(s.frozenDays).toEqual(['2026-11-03'])
    expect(s.freezesLeft).toBe(1)
  })

  it('breaks after more than two missed days in one week', () => {
    // Missed Wed, Thu, Fri of the week of Nov 9.
    const s = computeStreak(['2026-11-09', '2026-11-10', '2026-11-14'], '2026-11-14')
    expect(s.current).toBe(1)
    expect(s.frozenDays).toEqual([])
    expect(s.freezesLeft).toBe(2)
  })

  it('doesn’t spend freezes before the first day ever', () => {
    const s = computeStreak(['2026-11-04'], '2026-11-04')
    expect(s).toMatchObject({ current: 1, frozenDays: [], freezesLeft: 2 })
  })
})
