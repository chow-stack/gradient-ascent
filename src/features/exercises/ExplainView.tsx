import { Check, ChevronDown, CircleHelp, Sparkles, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { CodeBlock } from '../../components/CodeBlock'
import type { PointStatus, Verdict } from '../ai/gemini'
import type { Card } from '../content/schema'
import { inline } from './inline'
import { Prompt } from './shared'
import { type ViewProps } from './types'

type ExplainCard = Extract<Card, { type: 'explain' }>

const VERDICT: Record<Verdict, string> = { nailed: 'Nailed it', partly: 'Partly', missed: 'Missed it' }

/**
 * Explain in plain English. With a key saved, the AI grades the answer against the card's key points and the
 * session moves on like any other card (Continue, or Try again). Without one, or when the learner says the AI
 * got it wrong, they compare with a good answer and grade themselves.
 *
 * The good answer stays hidden while the learner can still try again, so a retry isn't just rewording it.
 */
export function ExplainView({
  card,
  answer,
  setAnswer,
  phase,
  ai = { status: 'off' },
  selfGrading,
  onRetryAi,
}: ViewProps<ExplainCard>) {
  const text = answer.type === 'explain' ? answer.text : ''
  const panel = useRef<HTMLDivElement>(null)
  const check = ai.status === 'done' ? ai.check : null
  const showPanel = phase !== 'answering'
  const modelOpen = phase === 'revealed'
  const modelAvailable = phase === 'correct' || phase === 'revealed'

  // The panel opens below the fold, behind the footer.
  useEffect(() => {
    if (showPanel) panel.current?.scrollIntoView({ block: 'nearest' })
  }, [showPanel, phase])

  return (
    <div className="flex flex-col gap-5">
      <Prompt tag="Explain it" text={card.prompt} />
      <CodeBlock code={card.code} />
      <label className="flex flex-col gap-2">
        <span className="text-small font-semibold text-muted">In your own words, one or two sentences</span>
        <textarea
          className="ga-textarea"
          value={text}
          readOnly={phase !== 'answering'}
          placeholder="This code…"
          onChange={(e) => setAnswer({ type: 'explain', text: e.target.value })}
        />
      </label>

      {showPanel && (
        <div ref={panel} aria-live="polite" className="ga-ai-panel ga-feedback-in scroll-mt-20 scroll-mb-40">
          {phase === 'checking' ? (
            <AiLoading points={card.keyPoints.length} />
          ) : (
            <>
              {check && !selfGrading && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="ga-ai-badge">
                      <Sparkles size={14} aria-hidden /> AI check
                    </span>
                    <span className="ga-verdict" data-verdict={check.verdict}>
                      {VERDICT[check.verdict]}
                    </span>
                  </div>
                  <p className="ga-prose">{inline(check.feedback)}</p>
                  {check.misconception && <p className="ga-prose text-danger">{inline(check.misconception)}</p>}
                </div>
              )}

              {!check && !selfGrading && phase === 'revealed' && (
                <h3 className="text-small font-semibold text-muted">A good answer</h3>
              )}

              <ul className="flex flex-col gap-2.5" aria-label="Key points">
                {card.keyPoints.map((k, i) => {
                  const status = selfGrading ? undefined : check?.points[i].status
                  return (
                    <li key={k} className="ga-ai-point" data-status={status}>
                      <PointIcon status={status} />
                      <div className="min-w-0">
                        <span className="sr-only">{status ? `${status}: ` : ''}</span>
                        <span className="ga-prose">{inline(k)}</span>
                        {status === 'hit' && check?.points[i].evidence && (
                          <p className="mt-0.5 text-small text-faint">You said “{check.points[i].evidence}”</p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>

              {modelAvailable && (
                <details className="ga-ai-model" open={modelOpen}>
                  <summary>
                    <ChevronDown size={16} aria-hidden /> Show a good answer
                  </summary>
                  <p className="ga-prose pt-2">{inline(card.model)}</p>
                </details>
              )}

              {ai.status === 'off' && selfGrading && (
                <p className="text-caption text-faint">Add an AI key in Settings to have your answers checked.</p>
              )}
              {ai.status === 'failed' && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="text-small text-muted">{ai.message} You can grade yourself instead.</p>
                  {onRetryAi && (
                    <button type="button" className="ga-btn ga-btn--ghost ga-btn--sm" onClick={onRetryAi}>
                      Ask the AI again
                    </button>
                  )}
                </div>
              )}
              {check && selfGrading && (
                <p className="text-caption text-faint">
                  The AI said “{VERDICT[check.verdict]}”. Compare with the good answer and pick your own grade.
                </p>
              )}
              {check && !selfGrading && phase !== 'revealed' && (
                <p className="text-caption text-faint">The AI can be wrong. If it is, say so below.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Placeholder rows for the key points, filling in while the AI reads. */
function AiLoading({ points }: { points: number }) {
  return (
    <div className="flex flex-col gap-4" role="status">
      <p className="flex items-center gap-2.5 font-semibold">
        <span className="ga-ai-orb" aria-hidden>
          <Sparkles size={15} />
        </span>
        AI is reading your answer
        <span className="ga-ai-dots" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </p>
      <ul className="flex flex-col gap-3" aria-hidden>
        {Array.from({ length: points }, (_, i) => (
          <li key={i} className="flex items-center gap-2.5" style={{ animationDelay: `${i * 160}ms` }}>
            <span className="ga-ai-skeleton size-4 flex-none rounded-full" style={{ animationDelay: `${i * 160}ms` }} />
            <span
              className="ga-ai-skeleton h-3.5 rounded-full"
              style={{ width: `${78 - ((i * 17) % 30)}%`, animationDelay: `${i * 160}ms` }}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function PointIcon({ status }: { status?: PointStatus }) {
  const cls = 'mt-1 flex-none'
  if (status === 'missed') return <X size={16} className={`${cls} text-danger`} aria-hidden />
  if (status === 'unclear') return <CircleHelp size={16} className={`${cls} text-xp`} aria-hidden />
  return <Check size={16} className={`${cls} ${status === 'hit' ? 'text-success' : 'text-faint'}`} aria-hidden />
}
