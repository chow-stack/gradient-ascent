import { useMemo, useState } from 'react'
import type { Card } from '../content/schema'
import { shuffled } from '../../lib/random'
import { Prompt, RunOutput } from './shared'
import { locked, type ViewProps } from './types'

type ParsonsCard = Extract<Card, { type: 'parsons' }>

/**
 * Parsons problem: put shuffled lines in order. Indentation is given (fixed-indent Parsons),
 * so the focus is on order and logic. Click a line to add it; click a placed line to send it back.
 */
export function ParsonsView({ card, answer, setAnswer, phase, result }: ViewProps<ParsonsCard>) {
  const pool = useMemo(() => shuffled([...card.code.replace(/\n$/, '').split('\n'), ...card.distractors]), [card])
  const [picked, setPicked] = useState<number[]>([])
  const isLocked = locked(phase)

  // "Show answer" replaces the placed lines with the solution.
  const solutionShown = phase === 'revealed' && answer.type === 'parsons'
  const placed = solutionShown ? answer.lines : picked.map((i) => pool[i])

  const update = (next: number[]) => {
    setPicked(next)
    setAnswer({ type: 'parsons', lines: next.map((i) => pool[i]) })
  }

  return (
    <div className="flex flex-col gap-5">
      <Prompt tag="Order the lines" text={card.prompt} />
      <div className="grid gap-4 md:grid-cols-2">
        <section aria-label="Your program" className="flex flex-col gap-2">
          <h3 className="text-small font-semibold text-muted">Your program</h3>
          <div className="ga-dropzone">
            {placed.length === 0 && <p className="m-auto text-small text-faint">Click lines to add them here</p>}
            {placed.map((line, pos) => (
              <button
                key={`${pos}-${line}`}
                type="button"
                className="ga-line"
                disabled={isLocked}
                data-state={phase === 'correct' ? 'correct' : phase === 'wrong' ? 'wrong' : undefined}
                onClick={() => update(picked.filter((_, p) => p !== pos))}
                aria-label={`Line ${pos + 1}: ${line.trim()}. Click to remove.`}
              >
                {line}
              </button>
            ))}
          </div>
        </section>
        <section aria-label="Available lines" className="flex flex-col gap-2">
          <h3 className="text-small font-semibold text-muted">
            Lines{card.distractors.length > 0 && ' (some are not needed)'}
          </h3>
          <div className="flex flex-col gap-1.5">
            {pool.map((line, i) =>
              picked.includes(i) || solutionShown ? null : (
                <button
                  key={i}
                  type="button"
                  className="ga-line"
                  disabled={isLocked}
                  onClick={() => update([...picked, i])}
                >
                  {line}
                </button>
              ),
            )}
          </div>
        </section>
      </div>
      {result && <RunOutput result={result} expectOutput={card.expectOutput} />}
    </div>
  )
}
