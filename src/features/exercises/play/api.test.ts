import { describe, expect, it } from 'vitest'
import { cellsBetween, py } from './api'

describe('cellsBetween', () => {
  it('is just the cell when both ends are the same', () => {
    expect(cellsBetween({ x: 2, y: 3 }, { x: 2, y: 3 })).toEqual([{ x: 2, y: 3 }])
  })

  it('fills every cell along a row, in order', () => {
    expect(cellsBetween({ x: 0, y: 1 }, { x: 3, y: 1 })).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ])
  })

  it('fills a diagonal and runs backwards too', () => {
    expect(cellsBetween({ x: 4, y: 0 }, { x: 0, y: 4 })).toEqual([0, 1, 2, 3, 4].map((i) => ({ x: 4 - i, y: i })))
  })

  it('leaves no gaps on a shallow slope', () => {
    const cells = cellsBetween({ x: 0, y: 0 }, { x: 6, y: 2 })
    expect(cells).toHaveLength(7)
    cells.slice(1).forEach((c, i) => {
      expect(c.x - cells[i].x).toBe(1)
      expect(Math.abs(c.y - cells[i].y)).toBeLessThanOrEqual(1)
    })
  })
})

describe('py', () => {
  it('writes Python literals for strings, numbers and nested lists', () => {
    expect(py('say "hi"')).toBe('"say \\"hi\\""')
    expect(py([1, 'a'])).toBe('[1,"a"]')
    expect(py([[0, 1]])).toBe('[[0,1]]')
  })
})
