import { useMemo } from 'react'
import { CodeBlock } from '../../components/CodeBlock'
import { shuffled } from '../../lib/random'
import type { Card } from '../content/schema'
import { Prompt } from './shared'
import { locked, type ViewProps } from './types'

type ChoiceCard = Extract<Card, { type: 'choice' }>

const looksLikeCode = (s: string) => !s.includes(' ') || /[()[\]{}=%+*'"\d]/.test(s)

export function ChoiceView({ card, answer, setAnswer, phase }: ViewProps<ChoiceCard>) {
  // Shuffled once per mount, so reviews don't reward remembering the position.
  const choices = useMemo(() => shuffled(card.choices), [card])
  const selected = answer.type === 'choice' ? answer.choice : null
  const done = locked(phase) && phase !== 'checking'
  const code = card.kind === 'predict' || card.choices.every(looksLikeCode)

  return (
    <div className="flex flex-col gap-5">
      <Prompt tag={card.kind === 'predict' ? 'Predict the output' : 'Quick check'} text={card.prompt} />
      {card.code && <CodeBlock code={card.code} highlightLine={card.highlightLine} numbered={!!card.highlightLine} />}
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Answers" data-choices>
        {choices.map((c, i) => {
          let state: string | undefined
          if (!done) state = selected === c ? 'selected' : undefined
          else if (c === card.answer) state = 'correct'
          else if (c === selected) state = 'wrong'
          else state = 'dim'
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={selected === c}
              data-key={i + 1}
              className={state === 'correct' && phase === 'correct' ? 'ga-choice ga-pop' : 'ga-choice'}
              data-state={state}
              disabled={locked(phase)}
              onClick={() => setAnswer({ type: 'choice', choice: c })}
            >
              <span className="ga-choice-key">{i + 1}</span>
              {code ? <code className="whitespace-pre-wrap">{c}</code> : <span>{c}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
