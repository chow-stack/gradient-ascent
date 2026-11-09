import { Check } from 'lucide-react'
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Adam } from '../../components/Adam'
import type { TaskStage, WritingState } from './fresh'

/**
 * The wait while today's coding tasks are written: Adam perched on an editor that fills itself with code, then runs
 * the tests, with the real steps listed underneath. Everything here follows what the writer is actually doing.
 */
const STEPS = [
  { stage: 'picking', label: 'Picking topics from your lessons' },
  { stage: 'writing', label: 'Writing the tasks' },
  { stage: 'testing', label: 'Testing them in real Python' },
] as const
const ORDER: TaskStage[] = ['picking', 'writing', 'testing', 'ready']

/** A sketch of a short function, as [indent, [width px, color][]] per line. */
const LINES: [number, [number, string][]][] = [
  [
    0,
    [
      [26, 'kw'],
      [84, 'fn'],
      [34, 'text'],
    ],
  ],
  [
    1,
    [
      [44, 'text'],
      [12, 'faint'],
      [14, 'num'],
    ],
  ],
  [
    1,
    [
      [40, 'kw'],
      [96, 'text'],
    ],
  ],
  [
    2,
    [
      [16, 'kw'],
      [70, 'text'],
      [30, 'str'],
    ],
  ],
  [
    3,
    [
      [52, 'text'],
      [18, 'faint'],
      [10, 'num'],
    ],
  ],
  [
    1,
    [
      [46, 'kw'],
      [44, 'fn'],
    ],
  ],
]
const LINE_S = 0.5
const TEST_COUNT = 8

export function WritingTasks({ state }: { state: NonNullable<WritingState> }) {
  const live = state.slots.filter((s) => s.stage !== 'failed')
  // The step on screen is the one the slowest task is on.
  const at = live.length ? Math.min(...live.map((s) => ORDER.indexOf(s.stage))) : ORDER.length - 1
  const ready = state.slots.filter((s) => s.stage === 'ready').length
  const retrying = state.slots.some((s) => s.attempt > 1 && (s.stage === 'writing' || s.stage === 'testing'))
  const testing = ORDER[at] === 'testing'

  // Adam cheers for a moment each time a task is done.
  const [cheer, setCheer] = useState(false)
  const [seen, setSeen] = useState(ready)
  if (ready !== seen) {
    setSeen(ready)
    if (ready > seen) setCheer(true)
  }
  useEffect(() => {
    if (!cheer) return
    const t = setTimeout(() => setCheer(false), 1100)
    return () => clearTimeout(t)
  }, [cheer])

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex w-full max-w-[400px] flex-col items-center px-4" role="status" aria-live="polite">
        <Editor testing={testing} cheer={cheer} />

        <h1 className="mt-9 text-center text-h2 text-balance">Writing today’s coding tasks</h1>
        <p className="mt-1.5 text-center text-small text-balance text-muted">
          Built from what you’ve learned, then checked in Python.
        </p>

        <ol className="mt-7 flex w-full max-w-[300px] flex-col gap-3.5">
          {STEPS.map((s, i) => (
            <Step
              key={s.stage}
              state={i < at ? 'done' : i === at ? 'active' : 'pending'}
              label={s.stage === 'writing' && retrying && i === at ? 'Rewriting one that failed a check' : s.label}
            />
          ))}
        </ol>
        <p className="mt-6 text-caption text-faint tabular-nums">
          {ready} of {state.slots.length} ready
        </p>
      </div>
    </MotionConfig>
  )
}

function Step({ state, label }: { state: 'done' | 'active' | 'pending'; label: string }) {
  return (
    <li className="flex items-center gap-3 text-small" data-state={state}>
      <span className="relative grid size-5 flex-none place-items-center">
        <AnimatePresence initial={false} mode="popLayout">
          {state === 'done' ? (
            <motion.span
              key="done"
              className="grid size-5 place-items-center rounded-full bg-success text-on-success"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 520, damping: 22 }}
            >
              <Check size={12} strokeWidth={3.5} aria-hidden />
            </motion.span>
          ) : state === 'active' ? (
            <motion.span
              key="active"
              className="ga-writing-spin size-5 rounded-full"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
            />
          ) : (
            <span className="size-2 rounded-full bg-progress-track" />
          )}
        </AnimatePresence>
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={label}
          className={state === 'active' ? 'font-semibold text-text' : state === 'done' ? 'text-muted' : 'text-faint'}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
        >
          {label}
          {state === 'done' && <span className="sr-only"> (done)</span>}
        </motion.span>
      </AnimatePresence>
    </li>
  )
}

/** A small editor that types itself out line by line, over and over, and lights up its tests while they run. */
function Editor({ testing, cheer }: { testing: boolean; cheer: boolean }) {
  const reduced = useReducedMotion()
  // Each pass through the code is a new key, so the lines type out again.
  const [pass, setPass] = useState(0)
  useEffect(() => {
    if (reduced) return
    const t = setInterval(() => setPass((p) => p + 1), (LINES.length * LINE_S + 2.2) * 1000)
    return () => clearInterval(t)
  }, [reduced])

  return (
    <div className="relative mt-10 w-[300px] max-w-full">
      {/* Adam peeks over the top of the editor, with ideas drifting up. */}
      <div className="absolute -top-[60px] right-6">
        {!reduced && <Sparks />}
        <motion.div
          animate={cheer ? { y: [0, -14, 0, -6, 0] } : { y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <Adam mood={cheer ? 'happy' : 'think'} size={88} />
        </motion.div>
      </div>

      <motion.div
        className="ga-writing-editor relative z-10"
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="ga-writing-chrome">
          <span>task.py</span>
          <AnimatePresence>
            {testing && (
              <motion.span
                className="text-success"
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
              >
                running tests
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="relative px-4 py-3.5" key={pass}>
          {/* The line being written. */}
          {!reduced && (
            <motion.div
              className="ga-writing-cursorline"
              initial={{ y: 0 }}
              animate={{ y: LINES.map((_, i) => i * 22) }}
              transition={{
                duration: LINES.length * LINE_S,
                ease: 'linear',
                times: LINES.map((_, i) => i / (LINES.length - 1)),
              }}
            />
          )}
          {LINES.map(([indent, tokens], i) => (
            <div key={i} className="relative flex h-[22px] items-center gap-1.5" style={{ paddingLeft: indent * 18 }}>
              <span className="ga-writing-gutter">{i + 1}</span>
              {tokens.map(([w, color], j) => (
                <motion.span
                  key={j}
                  className="ga-writing-token"
                  data-color={color}
                  style={{ width: w, originX: 0 }}
                  initial={reduced ? false : { scaleX: 0, opacity: 0 }}
                  animate={{ scaleX: 1, opacity: 1 }}
                  transition={{
                    delay: i * LINE_S + (j / tokens.length) * LINE_S * 0.7,
                    duration: LINE_S * 0.4,
                    ease: 'easeOut',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        <TestDots on={testing} />
      </motion.div>
    </div>
  )
}

/** One dot per test, filling in turn while the tasks are checked. */
function TestDots({ on }: { on: boolean }) {
  return (
    <div className="flex items-center gap-1.5 border-t border-border px-4 py-2.5">
      <span className="mr-1 font-mono text-[11px] text-faint">tests</span>
      {Array.from({ length: TEST_COUNT }, (_, i) => (
        <motion.span
          key={i}
          className="size-2 rounded-full"
          initial={false}
          animate={
            on
              ? { backgroundColor: ['#2c2f58', '#3ddc97', '#3ddc97', '#2c2f58'], scale: [1, 1.35, 1, 1] }
              : { backgroundColor: '#2c2f58', scale: 1 }
          }
          transition={
            on
              ? { duration: 2.4, times: [0, 0.08, 0.85, 1], delay: i * 0.12, repeat: Infinity, ease: 'easeOut' }
              : { duration: 0.2 }
          }
        />
      ))}
    </div>
  )
}

/** Little sparks of an idea rising from Adam's horns. */
function Sparks() {
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-2 h-0" aria-hidden>
      {[
        { x: 14, d: 0, c: '#ffc94d' },
        { x: 40, d: 0.9, c: '#ff7a2f' },
        { x: 58, d: 1.7, c: '#8fcbff' },
      ].map((s, i) => (
        <motion.span
          key={i}
          className="absolute size-1.5 rounded-full"
          style={{ left: s.x, background: s.c }}
          initial={{ y: 0, opacity: 0, scale: 0.6 }}
          animate={{ y: [-2, -30], x: [0, i % 2 ? 6 : -6], opacity: [0, 1, 0], scale: [0.6, 1, 0.4] }}
          transition={{ duration: 1.8, delay: s.d, repeat: Infinity, repeatDelay: 0.8, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}
