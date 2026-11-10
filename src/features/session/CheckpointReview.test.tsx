import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Card } from '../content/schema'
import { CheckpointReview } from './CheckpointReview'

afterEach(cleanup)

const choice = {
  type: 'choice',
  id: 'c',
  kind: 'predict',
  prompt: 'What does this print?',
  code: 'print(1 + 1)',
  choices: ['2', '11'],
  answer: '2',
  why: 'Numbers add.',
  misses: { '11': 'Joining is for text, not numbers.' },
  hints: [],
  variants: [],
} as unknown as Card

const write = {
  type: 'write',
  id: 'w',
  prompt: 'Write `double(n)`, which gives back twice `n`, for the checkpoint.',
  starter: 'def double(n):\n    pass\n',
  solution: 'def double(n):\n    return n * 2\n',
  why: 'Multiply by 2.',
  hints: [],
  variants: [],
} as unknown as Card

describe('CheckpointReview', () => {
  it('shows each missed question with the answer given, the right one, and why', () => {
    const onBack = vi.fn()
    const { container } = render(
      <CheckpointReview
        questions={[
          { key: 'a', card: choice, answer: { type: 'choice', choice: '11' } },
          { key: 'b', card: write },
        ]}
        onBack={onBack}
      />,
    )
    expect(screen.getByText('2 questions, as you saw them. A retake asks different ones.')).toBeTruthy()
    // Missed questions start open.
    expect(screen.getByText('Joining is for text, not numbers.')).toBeTruthy()
    expect(screen.getByText('Numbers add.')).toBeTruthy()
    expect(screen.getByText('You left this one blank.')).toBeTruthy()
    expect(container.textContent).toContain('return n * 2')
    fireEvent.click(screen.getByText('Back to results'))
    expect(onBack).toHaveBeenCalled()
  })
})
