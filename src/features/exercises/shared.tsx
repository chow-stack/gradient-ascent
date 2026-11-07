import { CheckCircle2, CircleX, EyeOff, Play } from 'lucide-react'
import { normalizeOutput, type RunError, type RunResult } from '../runner/harness'
import { usePythonStatus } from '../runner/python'
import { inline } from './inline'

/** Renders lesson text: blank-line paragraphs and `inline code`. */
export function Prose({ text, className }: { text: string; className?: string }) {
  return (
    <div className={['ga-prose', className].filter(Boolean).join(' ')}>
      {text
        .trim()
        .split(/\n\s*\n/)
        .map((para, i) => (
          <p key={i}>{inline(para)}</p>
        ))}
    </div>
  )
}

export function Prompt({ tag, text }: { tag: string; text: string }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <span className="ga-tag">{tag}</span>
      <h2 className="ga-prose text-[24px] leading-snug font-[650] text-balance">{inline(text)}</h2>
    </div>
  )
}

/** Output panel: printed text, the error (with line), and test rows. */
/** A crash inside a function shows the real traceback, because the call chain is the useful part. */
function errorText({ type, line, message, trace = [] }: RunError) {
  if (trace.length < 2) return `${type}${line ? ` (line ${line})` : ''}: ${message}`
  const frames = trace.map((f) => `  File "main.py", line ${f.line}, in ${f.where}\n    ${f.code}`)
  return ['Traceback (most recent call last):', ...frames, `${type}: ${message}`].join('\n')
}

export function RunOutput({ result, expectOutput }: { result: RunResult; expectOutput?: string }) {
  const hasTests = result.tests.length > 0
  const outputWrong =
    expectOutput !== undefined && result.ok && normalizeOutput(result.stdout) !== normalizeOutput(expectOutput)
  return (
    <div className="ga-output ga-feedback-in" aria-live="polite">
      <div className="ga-code-header">
        <span>Output</span>
        {hasTests && (
          <span>
            {result.tests.filter((t) => t.passed).length}/{result.tests.length} tests passed
          </span>
        )}
      </div>
      <pre>
        {result.stdout
          ? result.stdout.replace(/\n$/, '')
          : !result.error && !result.figures?.length && <span className="text-faint">(nothing printed)</span>}
        {result.error && (
          <span className="ga-output-error">
            {result.stdout ? '\n' : ''}
            {errorText(result.error)}
          </span>
        )}
      </pre>
      {result.figures?.map((png, i) => (
        <img
          key={i}
          src={`data:image/png;base64,${png}`}
          alt="The plot your code drew"
          className="mx-4 mb-4 max-w-[calc(100%-2rem)] rounded-lg bg-white"
        />
      ))}
      {outputWrong && (
        <div className="ga-test">
          <CircleX size={16} className="mt-0.5 flex-none text-danger" aria-hidden />
          <span>
            Expected output:
            <pre className="mt-1 !p-0 text-muted">{expectOutput!.replace(/\n$/, '')}</pre>
          </span>
        </div>
      )}
      {result.tests.map((t, i) => {
        if (t.hidden && t.passed) return null
        const label = t.hidden ? `Hidden test ${result.tests.slice(0, i + 1).filter((x) => x.hidden).length}` : null
        return (
          <div key={i} className="ga-test">
            {t.passed ? (
              <CheckCircle2 size={16} className="mt-0.5 flex-none text-success" aria-label="passed" />
            ) : (
              <CircleX size={16} className="mt-0.5 flex-none text-danger" aria-label="failed" />
            )}
            <span className="min-w-0">
              {label ? (
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <EyeOff size={14} aria-hidden /> {label} failed
                </span>
              ) : (
                <>
                  <code>{t.call}</code>
                  <span className="text-muted"> → </span>
                  <code className={t.passed ? 'text-success' : 'text-danger'}>
                    {t.error ? `${t.error.type}: ${t.error.message}` : t.got}
                  </code>
                  {!t.passed && !t.error && (
                    <span className="text-muted">
                      {' '}
                      (expected <code>{t.expect}</code>)
                    </span>
                  )}
                </>
              )}
            </span>
          </div>
        )
      })}
      {result.tests.some((t) => t.hidden && t.passed) && (
        <div className="ga-test text-muted">
          <CheckCircle2 size={16} className="mt-0.5 flex-none text-success" aria-hidden />
          Hidden tests passed: {result.tests.filter((t) => t.hidden && t.passed).length}
        </div>
      )}
    </div>
  )
}

/** "Run" button that knows when Python is still booting. */
export function RunButton({ onRun, running, label = 'Run' }: { onRun: () => void; running: boolean; label?: string }) {
  const status = usePythonStatus()
  const booting = status === 'loading' || status === 'idle'
  return (
    <button type="button" className="ga-btn ga-btn--secondary ga-btn--sm" onClick={onRun} disabled={running}>
      <Play size={14} aria-hidden />
      {running ? (booting ? 'Starting Python…' : 'Running…') : label}
    </button>
  )
}
