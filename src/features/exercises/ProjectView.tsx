import { Check, Circle, Flag, Lightbulb, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CodeEditor } from '../../components/editor'
import type { Card } from '../content/schema'
import type { RunResult } from '../runner/harness'
import { runPython } from '../runner/python'
import { saveDraft } from './drafts'
import type { MilestoneResult } from './grading'
import { inline } from './inline'
import { Prose, RunButton, RunOutput } from './shared'
import { locked, type ViewProps } from './types'

type ProjectCard = Extract<Card, { type: 'project' }>

/**
 * A project: a brief, one editor for the whole program, and a milestone checklist that ticks off as each part
 * works. No step-by-step code: hints come one at a time, for the next unfinished milestone, only when asked for.
 * The code is saved as the learner types (SessionRunner restores it), so they can leave and come back.
 */
export function ProjectView({
  card,
  answer,
  setAnswer,
  phase,
  result,
  milestones,
  draftKey,
  onSubmit,
}: ViewProps<ProjectCard>) {
  const code = answer.type === 'code' ? answer.code : ''
  const [scratch, setScratch] = useState<RunResult | null>(null)
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState(result)
  // Ticks stay after "Try again", until the next check.
  const [ticks, setTicks] = useState<MilestoneResult[] | undefined>(milestones)
  const [hintsShown, setHintsShown] = useState<Record<number, number>>({})
  if (result !== lastResult) {
    setLastResult(result)
    setScratch(null)
  }
  if (milestones && milestones !== ticks) setTicks(milestones)
  const shown = result ?? scratch

  // Keep the learner's own code, not a revealed solution.
  useEffect(() => {
    if (draftKey && phase === 'answering') saveDraft(draftKey, code)
  }, [draftKey, phase, code])

  const next = card.milestones.findIndex((_, i) => !ticks?.[i]?.passed)
  const done = ticks ? ticks.filter((t) => t.passed).length : 0
  const nextHints = next >= 0 ? card.milestones[next].hints : []
  const hintCount = next >= 0 ? (hintsShown[next] ?? 0) : 0

  const run = async () => {
    setRunning(true)
    setScratch(await runPython(code, [], {}, 10_000))
    setRunning(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-3">
        <span className="ga-tag">Project</span>
        <Prose text={card.brief} />
      </div>
      {card.example && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-small font-semibold text-muted">A finished one might print</h3>
          <pre className="ga-project-example">{card.example.replace(/\n$/, '')}</pre>
        </div>
      )}

      <section className="flex flex-col gap-3" aria-label="Milestones">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="flex items-center gap-2 font-semibold">
            <Flag size={16} className="text-accent" aria-hidden /> Milestones
          </h3>
          <span className="text-small text-muted tabular-nums">
            {done}/{card.milestones.length} done
          </span>
        </div>
        <ol className="flex flex-col gap-2">
          {card.milestones.map((m, i) => {
            const t = ticks?.[i]
            const state = t?.passed ? 'done' : i === next ? 'next' : 'todo'
            return (
              <li key={m.title} className="ga-milestone" data-state={state}>
                <MilestoneIcon passed={t?.passed} failed={!!t && !t.passed && i === next} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    <span className="sr-only">{t?.passed ? 'Done: ' : ''}</span>
                    {i + 1}. {m.title}
                  </p>
                  <p className="ga-prose text-small text-muted">{inline(m.goal)}</p>
                  {i === next && t?.message && <p className="mt-1 text-small text-danger">{inline(t.message)}</p>}
                  {i === next && hintCount > 0 && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {nextHints.slice(0, hintCount).map((h, j) => (
                        <p key={j} className="ga-prose flex gap-2 text-small">
                          <Lightbulb size={15} className="mt-0.5 flex-none text-sky" aria-hidden />
                          <span>{inline(h)}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
        {!locked(phase) && next >= 0 && hintCount < nextHints.length && (
          <button
            type="button"
            className="ga-btn ga-btn--ghost ga-btn--sm self-start"
            onClick={() => setHintsShown((h) => ({ ...h, [next]: hintCount + 1 }))}
          >
            <Lightbulb size={14} aria-hidden /> Stuck? Show me the next step
          </button>
        )}
      </section>

      <CodeEditor
        value={code}
        onChange={(v) => setAnswer({ type: 'code', code: v })}
        readOnly={locked(phase)}
        errorLine={shown?.error?.line ?? null}
        onSubmit={(latest) => {
          setAnswer({ type: 'code', code: latest })
          onSubmit({ type: 'code', code: latest })
        }}
        ariaLabel="Your program"
      />
      <div className="flex flex-wrap items-center gap-2">
        <RunButton onRun={run} running={running} />
        <span className="text-caption text-faint">Saved as you type.</span>
        <span className="ml-auto hidden text-caption text-faint sm:inline">
          <span className="ga-kbd">⌘</span> <span className="ga-kbd">↵</span> to check milestones
        </span>
      </div>
      {shown && <RunOutput result={shown} />}
    </div>
  )
}

function MilestoneIcon({ passed, failed }: { passed?: boolean; failed: boolean }) {
  const cls = 'mt-0.5 flex-none'
  if (passed) return <Check size={18} className={`${cls} text-success`} aria-hidden />
  if (failed) return <X size={18} className={`${cls} text-danger`} aria-hidden />
  return <Circle size={18} className={`${cls} text-faint`} aria-hidden />
}
