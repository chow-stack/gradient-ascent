import { ChevronDown, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { CodeBlock } from '../../components/CodeBlock'
import { CodeEditor } from '../../components/editor'
import type { Card } from '../content/schema'
import type { RunResult } from '../runner/harness'
import { runPython } from '../runner/python'
import { Prompt, Prose, RunButton, RunOutput } from './shared'
import { locked, type ViewProps } from './types'

type CodeCard = Extract<Card, { type: 'fix' | 'write' }>

/**
 * Fix-the-bug and write-a-function: a real editor, a Run button, and tests on Check. A Daily 5 coding task is a
 * write card with a title and a longer brief, and offers its model solution once it's solved.
 */
export function CodeView({ card, answer, setAnswer, phase, result, task, onSubmit }: ViewProps<CodeCard>) {
  const code = answer.type === 'code' ? answer.code : ''
  const [scratch, setScratch] = useState<RunResult | null>(null)
  const [running, setRunning] = useState(false)
  // A graded result replaces any earlier plain run; "Try again" clears both.
  const [lastResult, setLastResult] = useState(result)
  if (result !== lastResult) {
    setLastResult(result)
    setScratch(null)
  }
  const shown = result ?? scratch
  const visibleTests = card.tests?.filter((t) => !t.hidden) ?? []
  const hiddenCount = (card.tests?.length ?? 0) - visibleTests.length
  const original = card.type === 'fix' ? card.code : card.starter
  // Points at the bug only until the code changes, because after that the line may have moved.
  const markLine = card.type === 'fix' && code === card.code ? (card.highlightLine ?? null) : null

  const run = async () => {
    setRunning(true)
    // Plain run shows output and visible tests, without grading.
    setScratch(await runPython(code, visibleTests))
    setRunning(false)
  }

  return (
    <div className="flex flex-col gap-5">
      {task ? (
        <div className="flex flex-col gap-3">
          <Prompt tag="Coding task" text={task.title} />
          <Prose text={card.prompt} className="text-[17px]" />
        </div>
      ) : (
        <Prompt tag={card.type === 'fix' ? 'Fix the bug' : 'Write the code'} text={card.prompt} />
      )}
      {visibleTests.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-small font-semibold text-muted">Should work like this</h3>
          <ul className="flex flex-col gap-1 font-mono text-[13.5px]">
            {visibleTests.map((t, i) => (
              <li key={i}>
                <span className="text-code-text">{t.call}</span>
                <span className="text-faint"> → </span>
                <span className="text-syn-str">{t.expect}</span>
              </li>
            ))}
          </ul>
          {task && hiddenCount > 0 && (
            <p className="text-caption text-faint">Check also runs {hiddenCount} hidden tests, including edge cases.</p>
          )}
        </div>
      )}
      {card.expectOutput && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-small font-semibold text-muted">Should print</h3>
          <pre className="font-mono text-[13.5px] text-syn-str">{card.expectOutput.replace(/\n$/, '')}</pre>
        </div>
      )}
      {markLine && <p className="sr-only">Look at line {markLine}.</p>}
      <CodeEditor
        value={code}
        onChange={(v) => setAnswer({ type: 'code', code: v })}
        readOnly={locked(phase)}
        errorLine={shown?.error?.line ?? null}
        markLine={markLine}
        onSubmit={(latest) => {
          setAnswer({ type: 'code', code: latest })
          onSubmit({ type: 'code', code: latest })
        }}
        ariaLabel={card.type === 'fix' ? 'Code with a bug' : 'Your code'}
      />
      <div className="flex flex-wrap items-center gap-2">
        <RunButton onRun={run} running={running} />
        {!locked(phase) && code !== original && (
          <button
            type="button"
            className="ga-btn ga-btn--ghost ga-btn--sm"
            onClick={() => {
              setAnswer({ type: 'code', code: original })
              setScratch(null)
            }}
          >
            <RotateCcw size={14} aria-hidden /> Reset
          </button>
        )}
        <span className="ml-auto hidden text-caption text-faint sm:inline">
          <span className="ga-kbd">⌘</span> <span className="ga-kbd">↵</span> to check
        </span>
      </div>
      {shown && <RunOutput result={shown} expectOutput={card.expectOutput} />}
      {task && card.type === 'write' && phase === 'correct' && (
        <details className="ga-ai-model">
          <summary>
            <ChevronDown size={16} aria-hidden /> Compare with a model solution
          </summary>
          <div className="pt-3">
            <CodeBlock code={card.solution} />
          </div>
        </details>
      )}
    </div>
  )
}
