import { Check, ChevronRight, ExternalLink, Lightbulb } from 'lucide-react'
import { useState } from 'react'
import { CodeBlock } from '../../components/CodeBlock'
import type { Card } from '../content/schema'
import type { RunResult } from '../runner/harness'
import { runPython } from '../runner/python'
import { inline } from './inline'
import { Prose, RunButton, RunOutput } from './shared'

type LearnCard = Extract<Card, { type: 'learn' }>

/** Worked example: short text, labeled code, predict → run. */
export function LearnView({ card }: { card: LearnCard }) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const labels = Object.fromEntries(card.subgoals.map((s) => [s.line, s.label]))

  const run = async () => {
    if (!card.code) return
    setRunning(true)
    setResult(await runPython(card.code))
    setRunning(false)
  }

  // With code, the reading sits beside the example when the card has room (see .ga-split).
  return (
    <div className={card.code ? 'ga-split-wrap' : undefined}>
      <div className={card.code ? 'ga-split' : 'flex flex-col gap-5'}>
        <div className="ga-split-text flex flex-col gap-5">
          <div className="flex flex-col items-start gap-3">
            <span className="ga-tag">{card.label}</span>
            <h2 className="text-[26px] leading-snug font-[650] text-balance">{card.title}</h2>
          </div>
          <Prose text={card.body} className="max-w-[62ch] text-[17px] leading-relaxed text-text" />
          {card.points.length > 0 && <Points card={card} />}

          {card.deeper && (
            <details className="ga-deeper">
              <summary>Go deeper</summary>
              <Prose text={card.deeper} className="max-w-[62ch] text-muted" />
            </details>
          )}

          {card.link && (
            <a href={card.link.url} target="_blank" rel="noreferrer" className="ga-btn ga-btn--secondary self-start">
              {card.link.label} <ExternalLink size={16} aria-hidden />
            </a>
          )}
        </div>

        {card.code && (
          <div className="ga-split-side flex flex-col gap-5">
            <CodeBlock code={card.code} labels={labels} />

            {card.code && card.predict && !result && (
              <div className="ga-hint flex gap-3">
                <Lightbulb size={18} className="mt-0.5 flex-none text-sky" aria-hidden />
                <p>
                  <strong className="font-semibold">Predict first:</strong> {card.predict} Then run it.
                </p>
              </div>
            )}

            {card.code && (
              <div className="flex flex-wrap items-center gap-2">
                <RunButton onRun={run} running={running} label={result ? 'Run again' : 'Run it'} />
              </div>
            )}
            {result && <RunOutput result={result} />}
          </div>
        )}
      </div>
    </div>
  )
}

/** The goal's "what you'll do" list, or the recap's key points. */
function Points({ card }: { card: LearnCard }) {
  const recap = card.id === 'recap'
  const Icon = recap ? Check : ChevronRight
  return (
    <section className="ga-points" aria-label={recap ? 'Key points' : 'In this lesson'}>
      <h3>{recap ? 'Key points' : 'In this lesson you’ll'}</h3>
      <ul>
        {card.points.map((p) => (
          <li key={p}>
            <Icon size={17} className={recap ? 'text-success' : 'text-accent'} aria-hidden />
            <span>{inline(p)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
