import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { cardVariants, type Card } from '../features/content/schema'
import { lessons } from '../features/content/content'
import { CodeBlock } from './CodeBlock'

afterEach(cleanup)

const countInputs = (code: string) => {
  const { container } = render(<CodeBlock code={code} blank={(i) => <input aria-label={`Blank ${i}`} />} />)
  return container.querySelectorAll('input').length
}

describe('CodeBlock blanks', () => {
  it('renders a blank inside a string', () => {
    expect(countInputs('print(f"Level {____} of {____}")')).toBe(2)
  })

  it('gives every blank in every lesson an input', () => {
    const blanks = lessons
      .flatMap((l) => l.cards.flatMap((c): Card[] => [c, ...cardVariants(c)]))
      .filter((c) => c.type === 'blank')
    expect(blanks.length).toBeGreaterThan(0)
    for (const card of blanks) {
      expect(countInputs(card.code), card.code).toBe(card.answers.length)
      cleanup()
    }
  })
})
