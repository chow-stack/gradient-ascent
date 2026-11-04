import { Check, Flame, Lightbulb, RotateCcw, Star, X } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Adam, type AdamMood } from '../../components/Adam'
import { CodeBlock } from '../../components/CodeBlock'
import { SegmentedProgress } from '../../components/ui/ProgressBar'

type Choice = { id: string; label: ReactNode }
type Step =
  | {
      kind: 'choice'
      tag: string
      title: ReactNode
      code: string
      highlightLine?: number
      choices: Choice[]
      answer: string
      right: string
      wrong: string
      hint: string
    }
  | {
      kind: 'blank'
      tag: string
      title: ReactNode
      code: string
      answers: string[]
      right: string
      wrong: string
      hint: string
    }

const STEPS: Step[] = [
  {
    kind: 'choice',
    tag: 'Predict the output',
    title: 'What does this print?',
    code: `nums = [3, 1, 4]
total = 0
for n in nums:
    total += n
print(total)`,
    choices: [
      { id: 'a', label: <code>8</code> },
      { id: 'b', label: <code>4</code> },
      { id: 'c', label: <code>314</code> },
      { id: 'd', label: <code>[3, 1, 4]</code> },
    ],
    answer: 'a',
    right: 'The loop adds each number to total: 0 + 3 + 1 + 4 = 8.',
    wrong: 'It prints 8. total starts at 0 and the loop adds every number: 3 + 1 + 4.',
    hint: 'Track total line by line. What is it after the first pass through the loop?',
  },
  {
    kind: 'blank',
    tag: 'Fill in the blank',
    title: (
      <>
        Finish <code>biggest</code> so it returns the largest number.
      </>
    ),
    code: `def biggest(nums):
    best = nums[0]
    for n in nums:
        if n > best:
            best = ____
    return best`,
    answers: ['n'],
    right: 'When n beats the best so far, it becomes the new best.',
    wrong: 'The answer is n: when the current number beats best, best should become that number.',
    hint: 'Which variable holds the number the loop is looking at right now?',
  },
  {
    kind: 'choice',
    tag: 'Find the bug',
    title: 'This countdown never stops. What is missing inside the loop?',
    code: `i = 3
while i > 0:
    print(i)
print("Liftoff!")`,
    highlightLine: 2,
    choices: [
      { id: 'a', label: <code>i = 0</code> },
      { id: 'b', label: <code>i -= 1</code> },
      { id: 'c', label: <code>i += 1</code> },
      { id: 'd', label: <code>break</code> },
    ],
    answer: 'b',
    right: 'i -= 1 moves i toward 0, so the condition i > 0 eventually turns false.',
    wrong: 'It needs i -= 1. Without it, i stays 3 and i > 0 is true forever.',
    hint: 'The loop runs while i > 0. What has to happen to i for that to become false?',
  },
]

type Status = 'idle' | 'correct' | 'wrong'

/** A three-exercise sample lesson used on the style guide to show the UI working. Not the real lesson engine. */
export function LessonDemo() {
  const [stepIdx, setStepIdx] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [hintOpen, setHintOpen] = useState(false)
  const [results, setResults] = useState<boolean[]>([])
  const [shakeKey, setShakeKey] = useState(0)
  const blankRef = useRef<HTMLInputElement>(null)

  const done = stepIdx >= STEPS.length
  const step = STEPS[Math.min(stepIdx, STEPS.length - 1)]
  const canCheck = step.kind === 'choice' ? selected !== null : typed.trim().length > 0

  const check = useCallback(() => {
    if (!canCheck || status !== 'idle') return
    const ok =
      step.kind === 'choice' ? selected === step.answer : step.answers.includes(typed.trim().replace(/\s+/g, ''))
    setStatus(ok ? 'correct' : 'wrong')
    setResults((r) => [...r, ok])
    if (!ok) setShakeKey((k) => k + 1)
  }, [canCheck, status, step, selected, typed])

  const next = useCallback(() => {
    setStepIdx((i) => i + 1)
    setSelected(null)
    setTyped('')
    setStatus('idle')
    setHintOpen(false)
  }, [])

  const restart = () => {
    next()
    setStepIdx(0)
    setResults([])
  }

  useEffect(() => {
    if (!done && step.kind === 'blank' && status === 'idle') blankRef.current?.focus({ preventScroll: true })
  }, [done, step, status])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      // Form fields (the blank handles its own Enter) and buttons (Enter = click) manage themselves.
      if (done || ['SELECT', 'INPUT', 'TEXTAREA'].includes(t.tagName)) return
      if (e.key === 'Enter') {
        if (t.tagName === 'BUTTON') return
        e.preventDefault()
        if (status === 'idle') check()
        else next()
        return
      }
      if (step.kind === 'choice' && status === 'idle') {
        const n = Number(e.key)
        if (n >= 1 && n <= step.choices.length) setSelected(step.choices[n - 1].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [check, next, status, step, done])

  const mood: AdamMood = done
    ? 'happy'
    : status === 'correct'
      ? 'happy'
      : status === 'wrong'
        ? 'oops'
        : hintOpen
          ? 'think'
          : 'idle'
  const progress = done ? STEPS.length : stepIdx + (status === 'idle' ? 0 : 1)

  return (
    <div className="flex min-h-[620px] flex-col overflow-hidden rounded-lg border border-border bg-bg">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4">
        <button type="button" aria-label="Exit lesson" className="ga-icon-btn">
          <X size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <SegmentedProgress
            total={STEPS.length}
            done={progress}
            current={!done && status === 'idle' ? stepIdx : undefined}
            label="Lesson progress"
          />
        </div>
        <span className="ga-chip hidden text-accent sm:inline-flex" title="Day streak">
          <Flame size={16} aria-hidden /> 12
        </span>
      </div>

      {/* Body */}
      {done ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-10 text-center">
          <Adam mood="happy" size={132} title="Adam the goat, celebrating" />
          <div>
            <h3 className="ga-display text-[32px] leading-tight">Lesson complete</h3>
            <p className="ga-muted mt-2">You climbed a little higher today.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Stat
              icon={<Star size={18} />}
              color="var(--color-xp)"
              value={`+${results.filter(Boolean).length * 10 + 10}`}
              label="XP"
            />
            <Stat
              icon={<Check size={18} />}
              color="var(--color-success)"
              value={`${results.filter(Boolean).length}/${STEPS.length}`}
              label="Correct"
            />
            <Stat icon={<Flame size={18} />} color="var(--color-accent)" value="13" label="Day streak" />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 justify-center overflow-y-auto px-5 pt-4 pb-8 sm:px-8">
          <div className="flex w-full max-w-[640px] flex-col gap-5">
            <div className="flex flex-col items-start gap-3">
              <span className="ga-tag">{step.tag}</span>
              <h3 className="ga-display text-[24px] leading-snug [&_code]:rounded-md [&_code]:bg-raised [&_code]:px-1.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:font-medium">
                {step.title}
              </h3>
            </div>

            <div
              key={`code-${stepIdx}-${shakeKey}`}
              className={step.kind === 'blank' && status === 'wrong' ? 'ga-shake' : undefined}
            >
              <CodeBlock
                code={step.code}
                highlightLine={step.kind === 'choice' ? step.highlightLine : undefined}
                showRun={step.kind === 'blank'}
                blank={
                  step.kind === 'blank' ? (
                    <input
                      ref={blankRef}
                      aria-label="Your answer for the blank"
                      className="ga-blank"
                      value={status === 'wrong' ? step.answers[0] : typed}
                      data-state={status === 'idle' ? undefined : status}
                      readOnly={status !== 'idle'}
                      spellCheck={false}
                      autoComplete="off"
                      onChange={(e) => setTyped(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          e.stopPropagation()
                          if (status === 'idle') check()
                          else next()
                        }
                      }}
                    />
                  ) : undefined
                }
              />
            </div>

            {step.kind === 'choice' && (
              <div
                key={`choices-${stepIdx}-${shakeKey}`}
                className={status === 'wrong' ? 'ga-shake grid gap-3 sm:grid-cols-2' : 'grid gap-3 sm:grid-cols-2'}
                role="radiogroup"
                aria-label="Answers"
              >
                {step.choices.map((c, i) => {
                  let state: string | undefined
                  if (status === 'idle') state = selected === c.id ? 'selected' : undefined
                  else if (c.id === step.answer) state = 'correct'
                  else if (c.id === selected) state = 'wrong'
                  else state = 'dim'
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={selected === c.id}
                      className={state === 'correct' && status === 'correct' ? 'ga-choice ga-pop' : 'ga-choice'}
                      data-state={state}
                      disabled={status !== 'idle'}
                      onClick={() => setSelected(c.id)}
                    >
                      <span className="ga-choice-key">{i + 1}</span>
                      {c.label}
                    </button>
                  )
                })}
              </div>
            )}

            {hintOpen && status === 'idle' && (
              <div className="ga-hint ga-feedback-in flex gap-3">
                <Lightbulb size={18} className="mt-0.5 flex-none text-sky" aria-hidden />
                <p>{step.hint}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer / feedback */}
      <div
        className="ga-footer"
        data-state={done ? undefined : status === 'idle' ? undefined : status}
        aria-live="polite"
      >
        <div className="flex-none">
          <Adam mood={mood} size={56} />
        </div>
        <div
          key={`${stepIdx}-${status}`}
          className={status === 'idle' || done ? 'min-w-0 flex-1' : 'ga-feedback-in min-w-0 flex-1'}
        >
          {done ? (
            <p className="ga-footer-body ga-muted">Sample lesson. Press Try again to replay it.</p>
          ) : status === 'idle' ? (
            <p className="ga-footer-body ga-muted hidden sm:block">
              {step.kind === 'choice' ? 'Pick an answer, then check it.' : 'Type your answer in the blank.'}
            </p>
          ) : (
            <>
              <p className="ga-footer-title">{status === 'correct' ? 'Nice — that’s right.' : 'Not quite.'}</p>
              <p className="ga-footer-body mt-0.5">{status === 'correct' ? step.right : step.wrong}</p>
            </>
          )}
        </div>
        <div className="flex flex-none items-center gap-2">
          {done ? (
            <button type="button" className="ga-btn ga-btn--primary" onClick={restart}>
              <RotateCcw size={16} aria-hidden /> Try again
            </button>
          ) : status === 'idle' ? (
            <>
              <button
                type="button"
                className="ga-btn ga-btn--ghost"
                onClick={() => setHintOpen((h) => !h)}
                aria-expanded={hintOpen}
              >
                <Lightbulb size={16} aria-hidden /> <span className="hidden sm:inline">Hint</span>
              </button>
              <button type="button" className="ga-btn ga-btn--primary" disabled={!canCheck} onClick={check}>
                Check <span className="ga-kbd">↵</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              autoFocus
              className={status === 'correct' ? 'ga-btn ga-btn--success' : 'ga-btn ga-btn--danger'}
              onClick={next}
            >
              {stepIdx === STEPS.length - 1 ? 'Finish' : 'Continue'} <span className="ga-kbd">↵</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ icon, value, label, color }: { icon: ReactNode; value: string; label: string; color: string }) {
  return (
    <div className="ga-card flex min-w-[112px] flex-col items-center gap-1 px-5 py-4">
      <span className="flex items-center gap-1.5 text-[22px] font-semibold tabular-nums" style={{ color }}>
        <span aria-hidden className="flex">
          {icon}
        </span>
        {value}
      </span>
      <span className="ga-muted text-[13px]">{label}</span>
    </div>
  )
}
