import { ExternalLink, Lightbulb } from 'lucide-react'
import { useState } from 'react'
import { CodeBlock } from '../../components/CodeBlock'
import type { Card } from '../content/schema'
import type { RunResult } from '../runner/harness'
import { runPython } from '../runner/python'
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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-start gap-3">
        <span className="ga-tag">{card.label}</span>
        <h2 className="text-[26px] leading-snug font-[650] text-balance">{card.title}</h2>
      </div>
      <Prose text={card.body} className="max-w-[62ch] text-[17px] leading-relaxed text-text" />

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

      {card.code && <CodeBlock code={card.code} labels={labels} />}

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
  )
}
