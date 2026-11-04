import { Check } from 'lucide-react'
import { CodeBlock } from '../../components/CodeBlock'
import type { Card } from '../content/schema'
import { Prompt } from './shared'
import { inline } from './inline'
import { type ViewProps } from './types'

type ExplainCard = Extract<Card, { type: 'explain' }>

/**
 * Explain in plain English. Until the AI tutor exists (Phase 3), I compare my answer
 * with a model answer and grade myself honestly.
 */
export function ExplainView({ card, answer, setAnswer, phase }: ViewProps<ExplainCard>) {
  const text = answer.type === 'explain' ? answer.text : ''
  const revealed = phase === 'revealed'
  return (
    <div className="flex flex-col gap-5">
      <Prompt tag="Explain it" text={card.prompt} />
      <CodeBlock code={card.code} />
      <label className="flex flex-col gap-2">
        <span className="text-small font-semibold text-muted">In your own words, one or two sentences</span>
        <textarea
          className="ga-textarea"
          value={text}
          readOnly={revealed}
          placeholder="This code…"
          onChange={(e) => setAnswer({ type: 'explain', text: e.target.value })}
        />
      </label>
      {revealed && (
        <div className="ga-card ga-feedback-in flex flex-col gap-3">
          <h3 className="text-small font-semibold text-muted">A good answer</h3>
          <p className="ga-prose text-[17px]">{inline(card.model)}</p>
          <ul className="flex flex-col gap-1.5">
            {card.keyPoints.map((k) => (
              <li key={k} className="ga-prose flex gap-2 text-muted">
                <Check size={16} className="mt-1 flex-none text-success" aria-hidden />
                <span>{inline(k)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
