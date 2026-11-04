import { useEffect, useRef } from 'react'
import { CodeBlock } from '../../components/CodeBlock'
import type { Card } from '../content/schema'
import { Prompt, RunOutput } from './shared'
import { locked, type ViewProps } from './types'

type BlankCard = Extract<Card, { type: 'blank' }>

export function BlankView({ card, answer, setAnswer, phase, result, onSubmit }: ViewProps<BlankCard>) {
  const values = answer.type === 'blank' ? answer.values : []
  const first = useRef<HTMLInputElement>(null)
  const state = phase === 'correct' ? 'correct' : phase === 'wrong' ? 'wrong' : undefined

  useEffect(() => {
    if (phase === 'answering') first.current?.focus({ preventScroll: true })
  }, [phase])

  return (
    <div className="flex flex-col gap-5">
      <Prompt tag="Fill in the blank" text={card.prompt} />
      <CodeBlock
        code={card.code}
        blank={(i) => (
          <input
            ref={i === 0 ? first : undefined}
            aria-label={`Blank ${i + 1}`}
            className="ga-blank"
            style={{ width: `${Math.max(5, (values[i]?.length ?? 0) + 2, card.answers[i][0].length + 2)}ch` }}
            value={values[i] ?? ''}
            data-state={state}
            readOnly={locked(phase)}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            onChange={(e) => {
              const next = [...values]
              next[i] = e.target.value
              setAnswer({ type: 'blank', values: next })
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation() // handled here; don't let the session's Enter handler run too
                onSubmit()
              }
            }}
          />
        )}
      />
      {result && <RunOutput result={result} expectOutput={card.expectOutput} />}
    </div>
  )
}
