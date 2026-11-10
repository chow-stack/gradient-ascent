import { Check, ChevronDown, Circle, FileText, Flag, Lightbulb, LoaderCircle, Sparkles, X } from 'lucide-react'
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CodeEditor } from '../../components/editor'
import type { Card } from '../content/schema'
import type { RunResult } from '../runner/harness'
import { runPython } from '../runner/python'
import { saveDraft } from './drafts'
import { gradeMilestone, type MilestoneResult } from './grading'
import { inline } from './inline'
import { PlayPanel } from './play/PlayPanel'
import { Prose, RunButton, RunOutput } from './shared'
import { locked, type ViewProps } from './types'

type ProjectCard = Extract<Card, { type: 'project' }>

/** Below this width (of the card area, not the window) the brief, code, play and output become tabs. */
const WIDE_MIN_WIDTH = 880
/** The editor's starting height, in lines. It grows past this as the program does. */
const EDITOR_LINES = 20

type Tab = 'brief' | 'code' | 'play' | 'output'
type Side = 'brief' | 'play'

/**
 * A project: a brief, one editor for the whole program, and a milestone checklist that ticks off as each part
 * works. No step-by-step code: hints come one at a time, for the next unfinished milestone, only when asked for.
 * The code is saved as the learner types (SessionRunner restores it), so they can leave and come back.
 *
 * It fills the screen so nothing needs page scrolling: brief and milestones on the left, editor over output on
 * the right, each scrolling on its own. Where that doesn't fit, the three become tabs, with the current
 * milestone pinned above the editor.
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
  // The brief starts folded once there's work in progress: it's been read already.
  const [briefOpen, setBriefOpen] = useState(code === card.starter)
  const [tab, setTab] = useState<Tab>(code === card.starter ? 'brief' : 'code')
  const [side, setSide] = useState<Side>('brief')
  // The game stays mounted once opened, so switching tabs doesn't lose it.
  const [played, setPlayed] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const width = useWidth(box)
  const wide = width >= WIDE_MIN_WIDTH
  const outputRef = useRef<HTMLDivElement>(null)

  if (result !== lastResult) {
    setLastResult(result)
    setScratch(null)
  }
  // A full check replaces the ticks; "Check this step" changes them in between.
  const [lastMilestones, setLastMilestones] = useState(milestones)
  if (milestones !== lastMilestones) {
    setLastMilestones(milestones)
    if (milestones) setTicks(milestones)
  }
  const shown = result ?? scratch

  // Keep the learner's own code, not a revealed solution.
  useEffect(() => {
    if (draftKey && phase === 'answering') saveDraft(draftKey, code)
  }, [draftKey, phase, code])

  const next = card.milestones.findIndex((_, i) => !ticks?.[i]?.passed)
  const done = ticks ? ticks.filter((t) => t.passed).length : 0
  const hintCount = next >= 0 ? (hintsShown[next] ?? 0) : 0
  const moreHints = !locked(phase) && next >= 0 && hintCount < card.milestones[next].hints.length
  const showHint = () => setHintsShown((h) => ({ ...h, [next]: hintCount + 1 }))
  const [stepChecking, setStepChecking] = useState(false)

  /** Check only the milestone being worked on, without the final check. */
  const checkStep = async () => {
    if (next < 0 || stepChecking) return
    const i = next
    setStepChecking(true)
    const { run, result: r } = await gradeMilestone(card, code, i)
    setStepChecking(false)
    setTicks((t) => {
      const all = card.milestones.map((_, j) => t?.[j] ?? { passed: false })
      all[i] = r
      return all
    })
    setScratch(run)
    if (!wide && !r.passed) setTab('output')
  }
  const step = { onCheckStep: locked(phase) ? undefined : () => void checkStep(), stepChecking }

  const run = async () => {
    setRunning(true)
    setScratch(await runPython(code, [], {}, 10_000))
    setRunning(false)
    setTab('output')
  }

  // Beside the brief, the output sits under the program: bring it into view when there's something new in it.
  useEffect(() => {
    if (wide && shown) outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [wide, shown])

  const openTab = (t: Tab | Side) => {
    if (t === 'play') setPlayed(true)
    if (wide && (t === 'brief' || t === 'play')) setSide(t)
    else setTab(t as Tab)
  }

  const play = card.play && played && <PlayPanel kind={card.play} code={code} />
  const playShown = wide ? side === 'play' : tab === 'play'

  const milestoneList = (
    <Milestones
      card={card}
      ticks={ticks}
      next={next}
      done={done}
      hintCount={hintCount}
      moreHints={moreHints}
      onHint={showHint}
      {...step}
    />
  )

  const editor = (
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
      minLines={EDITOR_LINES}
      maxLines={Infinity}
      frame={false}
    />
  )

  const program = (
    <div className="ga-project-program">
      <EditorBar running={running} onRun={run} />
      {editor}
    </div>
  )

  const output = shown ? (
    <RunOutput result={shown} />
  ) : (
    <p className="ga-project-output-empty">
      Press Run to see what your program prints, or Check this step to test the milestone you’re on.
    </p>
  )

  const briefAndMilestones = (
    <>
      <Brief card={card} open={briefOpen} onToggle={() => setBriefOpen((o) => !o)} />
      {milestoneList}
    </>
  )

  return (
    <div ref={box} className="flex flex-col">
      {width === 0 ? null : wide ? (
        <div className="ga-project-wide">
          <section className="ga-project-side" aria-label="Brief and play">
            {card.play && (
              <Tabs
                tabs={[
                  ['brief', `Brief · ${done}/${card.milestones.length}`],
                  ['play', 'Play'],
                ]}
                current={side}
                onPick={openTab}
              />
            )}
            <div className="ga-project-pane flex flex-col gap-5" hidden={side !== 'brief'}>
              {briefAndMilestones}
            </div>
            {play && (
              <div className="ga-project-pane flex flex-col" hidden={!playShown}>
                {play}
              </div>
            )}
          </section>
          <section className="flex min-w-0 flex-col gap-3" aria-label="Your program">
            {program}
            <div ref={outputRef} className="ga-project-output">
              {output}
            </div>
          </section>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Tabs
            tabs={[
              ['brief', `Brief · ${done}/${card.milestones.length}`],
              ['code', 'Code'],
              ...(card.play ? [['play', 'Play'] as [Tab, string]] : []),
              ['output', 'Output'],
            ]}
            current={tab}
            onPick={openTab}
            dot={scratch && tab !== 'output' ? 'output' : undefined}
            sticky
          />
          {tab === 'brief' && (
            <div className="flex flex-col gap-5" role="tabpanel">
              {briefAndMilestones}
            </div>
          )}
          {tab === 'code' && (
            <div className="flex flex-col gap-3" role="tabpanel">
              <MilestoneStrip
                card={card}
                ticks={ticks}
                next={next}
                done={done}
                hintCount={hintCount}
                moreHints={moreHints}
                onHint={showHint}
                {...step}
              />
              {program}
            </div>
          )}
          {play && (
            <div className="ga-project-play-narrow flex flex-col" role="tabpanel" hidden={!playShown}>
              {play}
            </div>
          )}
          {tab === 'output' && (
            <div className="ga-project-output" role="tabpanel">
              {output}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Tabs<T extends string>({
  tabs,
  current,
  onPick,
  dot,
  sticky,
}: {
  tabs: [T, string][]
  current: T
  onPick: (t: T) => void
  dot?: T
  /** Stay under the top bar as the page scrolls (the narrow layout, where the tabs are the only way around). */
  sticky?: boolean
}) {
  return (
    <div
      className={`ga-project-tabs flex-none${sticky ? ' ga-project-tabs--sticky' : ''}`}
      role="tablist"
      aria-label="Project"
    >
      {tabs.map(([t, label]) => (
        <button key={t} type="button" role="tab" aria-selected={current === t} onClick={() => onPick(t)}>
          {label}
          {dot === t && <span className="ga-project-dot" aria-hidden />}
        </button>
      ))}
    </div>
  )
}

/** The brief and example, folding down to one line once read. */
function Brief({ card, open, onToggle }: { card: ProjectCard; open: boolean; onToggle: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <button type="button" className="ga-project-brief-toggle" aria-expanded={open} onClick={onToggle}>
        <span className="ga-tag flex-none">
          <FileText size={13} aria-hidden /> Project brief
        </span>
        {!open && <span className="min-w-0 flex-1 truncate text-small text-muted">{firstSentence(card.brief)}</span>}
        <ChevronDown size={16} className="ml-auto flex-none text-muted" aria-hidden />
      </button>
      {open && (
        <>
          <Prose text={card.brief} />
          {card.example && (
            <div className="flex flex-col gap-1.5">
              <h3 className="text-small font-semibold text-muted">A finished one might print</h3>
              <pre className="ga-project-example">{card.example.replace(/\n$/, '')}</pre>
            </div>
          )}
        </>
      )}
    </div>
  )
}

type MilestoneProps = {
  card: ProjectCard
  ticks?: MilestoneResult[]
  next: number
  done: number
  hintCount: number
  moreHints: boolean
  onHint: () => void
  /** Check just the current milestone. */
  onCheckStep?: () => void
  stepChecking?: boolean
}

/** The checklist. The current milestone is open; the rest show their title and open when clicked. */
function Milestones({ card, ticks, next, done, hintCount, moreHints, onHint, ...step }: MilestoneProps) {
  const [opened, setOpened] = useState<Set<number>>(new Set())
  const toggle = (i: number) =>
    setOpened((s) => {
      const n = new Set(s)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })

  return (
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
          const current = i === next
          const open = current || opened.has(i)
          return (
            <Fragment key={m.title}>
              {m.stage && (
                <li role="presentation" className="ga-milestone-stage">
                  {m.stage}
                </li>
              )}
              <li className="ga-milestone" data-state={t?.passed ? 'done' : current ? 'next' : 'todo'}>
                <MilestoneIcon passed={t?.passed} failed={!!t && !t.passed && current} />
                <div className="min-w-0 flex-1">
                  {current ? (
                    <p className="font-semibold">
                      {i + 1}. {m.title}
                    </p>
                  ) : (
                    <button
                      type="button"
                      className="w-full text-left font-semibold"
                      aria-expanded={open}
                      onClick={() => toggle(i)}
                    >
                      <span className="sr-only">{t?.passed ? 'Done: ' : ''}</span>
                      {i + 1}. {m.title}
                    </button>
                  )}
                  {open && (
                    <>
                      <p className="ga-prose mt-0.5 text-small text-muted">{inline(m.goal)}</p>
                      <MilestoneSpec m={m} />
                    </>
                  )}
                  {current && (
                    <CurrentDetails m={m} t={t} hintCount={hintCount} moreHints={moreHints} onHint={onHint} {...step} />
                  )}
                </div>
              </li>
            </Fragment>
          )
        })}
      </ol>
      {next < 0 && ticks && card.extras.length > 0 && (
        <div className="ga-milestone flex-col gap-1.5!" data-state="extra">
          <p className="flex items-center gap-2 font-semibold">
            <Sparkles size={16} className="text-xp" aria-hidden /> Make it yours
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-small text-muted">
            {card.extras.map((x) => (
              <li key={x} className="ga-prose">
                {inline(x)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/** What a milestone should do, by example: calls and what they give back, or a short sample of what it shows. */
function MilestoneSpec({ m }: { m: ProjectCard['milestones'][number] }) {
  return (
    <>
      {m.examples.length > 0 && (
        <table className="ga-milestone-examples">
          <thead>
            <tr>
              <th scope="col">You call</th>
              <th scope="col">It gives back</th>
            </tr>
          </thead>
          <tbody>
            {m.examples.map((e) => (
              <tr key={e.call}>
                <td>{e.call}</td>
                <td>{e.gives}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {m.shows && <pre className="ga-milestone-shows">{m.shows.replace(/\n$/, '')}</pre>}
    </>
  )
}

/** The failure message, hints shown so far, and the button for the next one. */
function CurrentDetails({
  m,
  t,
  hintCount,
  moreHints,
  onHint,
  onCheckStep,
  stepChecking,
}: {
  m: ProjectCard['milestones'][number]
  t?: MilestoneResult
  hintCount: number
  moreHints: boolean
  onHint: () => void
  onCheckStep?: () => void
  stepChecking?: boolean
}) {
  return (
    <>
      {t?.message && <p className="mt-1.5 text-small text-danger">{inline(t.message)}</p>}
      {hintCount > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {m.hints.slice(0, hintCount).map((h, j) => (
            <p key={j} className="ga-prose flex gap-2 text-small">
              <Lightbulb size={15} className="mt-0.5 flex-none text-sky" aria-hidden />
              <span>{inline(h)}</span>
            </p>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {onCheckStep && (
          <button
            type="button"
            className="ga-btn ga-btn--secondary ga-btn--sm"
            disabled={stepChecking}
            onClick={onCheckStep}
          >
            {stepChecking ? (
              <LoaderCircle size={14} className="animate-spin" aria-hidden />
            ) : (
              <Check size={14} aria-hidden />
            )}
            Check this step
          </button>
        )}
        {moreHints && (
          <button type="button" className="ga-btn ga-btn--ghost ga-btn--sm" onClick={onHint}>
            <Lightbulb size={14} aria-hidden /> Stuck? Show me the next step
          </button>
        )}
      </div>
    </>
  )
}

/** On narrow screens: the current milestone, pinned above the editor, opening to its goal and hints. */
function MilestoneStrip({ card, ticks, next, done, hintCount, moreHints, onHint, ...step }: MilestoneProps) {
  const [open, setOpen] = useState(false)
  if (next < 0)
    return (
      <p className="ga-project-strip text-success">
        <Check size={16} aria-hidden /> All {card.milestones.length} milestones done
      </p>
    )
  const m = card.milestones[next]
  return (
    <div className="ga-project-strip flex-col items-stretch!">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex-none text-small text-muted tabular-nums">
          {done}/{card.milestones.length}
        </span>
        <span className="min-w-0 flex-1 truncate font-semibold">{m.title}</span>
        <ChevronDown
          size={16}
          className={`flex-none text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && (
        <div className="pt-1.5">
          <p className="ga-prose text-small text-muted">{inline(m.goal)}</p>
          <MilestoneSpec m={m} />
          <CurrentDetails
            m={m}
            t={ticks?.[next]}
            hintCount={hintCount}
            moreHints={moreHints}
            onHint={onHint}
            {...step}
          />
        </div>
      )}
    </div>
  )
}

/** The bar on top of the editor: Run, the save note and the check shortcut. It sticks under the top bar. */
function EditorBar({ running, onRun }: { running: boolean; onRun: () => void }) {
  return (
    <div className="ga-project-editor-bar">
      <span className="text-caption font-semibold text-muted">main.py</span>
      <span className="text-caption text-faint">Saved as you type</span>
      <span className="ml-auto hidden text-caption text-faint lg:inline">
        <span className="ga-kbd">⌘</span> <span className="ga-kbd">↵</span> checks every milestone
      </span>
      <RunButton onRun={onRun} running={running} />
    </div>
  )
}

const firstSentence = (text: string) => text.trim().split(/(?<=[.!?])\s/)[0]

/** The element's width, kept up to date. 0 until measured. */
function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return width
}

function MilestoneIcon({ passed, failed }: { passed?: boolean; failed: boolean }) {
  const cls = 'mt-0.5 flex-none'
  if (passed) return <Check size={18} className={`${cls} text-success`} aria-hidden />
  if (failed) return <X size={18} className={`${cls} text-danger`} aria-hidden />
  return <Circle size={18} className={`${cls} text-faint`} aria-hidden />
}
