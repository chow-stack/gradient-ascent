import { Check, CircleHelp, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CodeBlock } from '../../components/CodeBlock'
import { checkExplanation, getGeminiKey, type ExplainCheck, type PointStatus } from '../ai/gemini'
import type { Card } from '../content/schema'
import { Prompt } from './shared'
import { inline } from './inline'
import { type ViewProps } from './types'

type ExplainCard = Extract<Card, { type: 'explain' }>
type CheckState = { status: 'idle' } | { status: 'done'; check: ExplainCheck } | { status: 'failed'; message: string }

const VERDICT = { nailed: 'Nailed it', partly: 'Partly', missed: 'Missed it' }

/** Explain in plain English: compare with a model answer, with Gemini's check if a key is saved. I pick the grade. */
export function ExplainView({ card, answer, setAnswer, phase }: ViewProps<ExplainCard>) {
  const text = answer.type === 'explain' ? answer.text : ''
  const revealed = phase === 'revealed'
  const [hasKey] = useState(() => getGeminiKey() !== '')
  const [state, setState] = useState<CheckState>({ status: 'idle' })
  const [attempt, setAttempt] = useState(0)

  const panel = useRef<HTMLDivElement>(null)

  // The panel opens below the fold, behind the footer.
  useEffect(() => {
    if (revealed) panel.current?.scrollIntoView({ block: 'start' })
  }, [revealed])

  useEffect(() => {
    if (!revealed || !hasKey) return
    let live = true
    checkExplanation(card, text).then(
      (check) => live && setState({ status: 'done', check }),
      (e: Error) => live && setState({ status: 'failed', message: e.message }),
    )
    return () => {
      live = false
    }
  }, [revealed, hasKey, card, text, attempt])

  const check = state.status === 'done' ? state.check : null

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
        <div ref={panel} className="ga-card ga-feedback-in flex scroll-mt-20 scroll-mb-40 flex-col gap-4 p-5 sm:p-6">
          <div className="flex flex-col gap-2">
            <h3 className="text-small font-semibold text-muted">A good answer</h3>
            <p className="ga-prose text-[17px]">{inline(card.model)}</p>
          </div>
          <ul className="flex flex-col gap-2.5">
            {card.keyPoints.map((k, i) => (
              <li key={k} className="ga-prose flex gap-2.5">
                <PointIcon status={check?.points[i].status} />
                <div className="min-w-0 text-muted">
                  <span className="sr-only">{check ? `${check.points[i].status}: ` : ''}</span>
                  {inline(k)}
                  {check?.points[i].evidence && (
                    <p className="mt-0.5 text-small text-faint">You said “{check.points[i].evidence}”</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div aria-live="polite" className="border-t border-border pt-4 empty:hidden">
            {!hasKey ? (
              <p className="text-small text-faint">Add a Gemini key in Settings to have your answer checked.</p>
            ) : state.status === 'idle' ? (
              <p className="flex items-center gap-2 text-small text-muted">
                <Sparkles size={15} className="text-sky" aria-hidden /> Gemini is reading your answer…
              </p>
            ) : state.status === 'failed' ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="text-small text-muted">{state.message} You can still grade yourself.</p>
                <button
                  type="button"
                  className="ga-btn ga-btn--ghost ga-btn--sm"
                  onClick={() => {
                    setState({ status: 'idle' })
                    setAttempt((a) => a + 1)
                  }}
                >
                  Try again
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Sparkles size={15} className="text-sky" aria-hidden /> Gemini says: {VERDICT[state.check.verdict]}
                </h3>
                <p className="ga-prose">{inline(state.check.feedback)}</p>
                {state.check.misconception && (
                  <p className="ga-prose text-danger">{inline(state.check.misconception)}</p>
                )}
                <p className="mt-1 text-caption text-faint">Gemini can be wrong. The grade is yours.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PointIcon({ status }: { status?: PointStatus }) {
  const cls = 'mt-1 flex-none'
  if (status === 'missed') return <X size={16} className={`${cls} text-danger`} aria-hidden />
  if (status === 'unclear') return <CircleHelp size={16} className={`${cls} text-xp`} aria-hidden />
  return <Check size={16} className={`${cls} ${status === 'hit' ? 'text-success' : 'text-faint'}`} aria-hidden />
}
