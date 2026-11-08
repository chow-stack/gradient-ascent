import { Check, ChevronDown, Circle, FileText, Flag, Lightbulb, Sparkles, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { CodeEditor } from '../../components/editor'
import type { Card } from '../content/schema'
import type { RunResult } from '../runner/harness'
import { runPython } from '../runner/python'
import { saveDraft } from './drafts'
import type { MilestoneResult } from './grading'
import { inline } from './inline'
import { PlayPanel } from './play/PlayPanel'
import { Prose, RunButton, RunOutput } from './shared'
import { locked, type ViewProps } from './types'

type ProjectCard = Extract<Card, { type: 'project' }>

/** Below this width (of the card area, not the window) the panels become tabs. */
const SPLIT_MIN_WIDTH = 880
/** The editor's share of the right-hand panel, in percent. */
const SPLIT_DEFAULT = 64
const SPLIT_MIN = 25
const SPLIT_MAX = 85

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
  const [split, setSplit] = useState(SPLIT_DEFAULT)
  const box = useRef<HTMLDivElement>(null)
  const width = useWidth(box)
  const wide = width >= SPLIT_MIN_WIDTH

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
  const hintCount = next >= 0 ? (hintsShown[next] ?? 0) : 0
  const moreHints = !locked(phase) && next >= 0 && hintCount < card.milestones[next].hints.length
  const showHint = () => setHintsShown((h) => ({ ...h, [next]: hintCount + 1 }))

  const run = async () => {
    setRunning(true)
    setScratch(await runPython(code, [], {}, 10_000))
    setRunning(false)
    setTab('output')
  }

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
    />
  )

  const editor = (
    <CodeEditor
      fill
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
  )

  const output = shown ? (
    <RunOutput result={shown} />
  ) : (
    <div className="grid h-full min-h-24 place-items-center rounded-md border border-dashed border-border p-4 text-center text-small text-faint">
      Press Run to see what your program prints, or Check to test the milestones.
    </div>
  )

  return (
    <div ref={box} className="flex min-h-0 flex-1 flex-col">
      {width === 0 ? null : wide ? (
        <div className="flex min-h-0 flex-1 gap-5">
          <section className="flex w-[40%] max-w-[540px] min-w-[340px] flex-col gap-3" aria-label="Brief and play">
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
            <div
              className="ga-project-pane flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-2"
              hidden={side !== 'brief'}
            >
              <Brief card={card} open={briefOpen} onToggle={() => setBriefOpen((o) => !o)} />
              {milestoneList}
            </div>
            {play && (
              <div className="ga-project-pane flex min-h-0 flex-1 flex-col overflow-y-auto pr-2" hidden={!playShown}>
                {play}
              </div>
            )}
          </section>
          <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Your program">
            <div className="min-h-0" style={{ height: `${split}%` }}>
              {editor}
            </div>
            <Toolbar running={running} onRun={run} split={split} onSplit={setSplit} box={box} />
            <div className="ga-project-pane min-h-0 flex-1 overflow-y-auto">{output}</div>
          </section>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
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
          />
          {tab === 'brief' && (
            <div className="ga-project-pane flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto" role="tabpanel">
              <Brief card={card} open={briefOpen} onToggle={() => setBriefOpen((o) => !o)} />
              {milestoneList}
            </div>
          )}
          {tab === 'code' && (
            <div className="flex min-h-0 flex-1 flex-col gap-2" role="tabpanel">
              <MilestoneStrip
                card={card}
                ticks={ticks}
                next={next}
                done={done}
                hintCount={hintCount}
                moreHints={moreHints}
                onHint={showHint}
              />
              <div className="min-h-0 flex-1">{editor}</div>
              <Toolbar running={running} onRun={run} />
            </div>
          )}
          {play && (
            <div
              className="ga-project-pane flex min-h-0 flex-1 flex-col overflow-y-auto pr-1"
              role="tabpanel"
              hidden={!playShown}
            >
              {play}
            </div>
          )}
          {tab === 'output' && (
            <div className="ga-project-pane min-h-0 flex-1 overflow-y-auto" role="tabpanel">
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
}: {
  tabs: [T, string][]
  current: T
  onPick: (t: T) => void
  dot?: T
}) {
  return (
    <div className="ga-project-tabs flex-none" role="tablist" aria-label="Project">
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
}

/** The checklist. The current milestone is open; the rest show their title and open when clicked. */
function Milestones({ card, ticks, next, done, hintCount, moreHints, onHint }: MilestoneProps) {
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
            <li key={m.title} className="ga-milestone" data-state={t?.passed ? 'done' : current ? 'next' : 'todo'}>
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
                {open && <p className="ga-prose mt-0.5 text-small text-muted">{inline(m.goal)}</p>}
                {current && <CurrentDetails m={m} t={t} hintCount={hintCount} moreHints={moreHints} onHint={onHint} />}
              </div>
            </li>
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

/** The failure message, hints shown so far, and the button for the next one. */
function CurrentDetails({
  m,
  t,
  hintCount,
  moreHints,
  onHint,
}: {
  m: ProjectCard['milestones'][number]
  t?: MilestoneResult
  hintCount: number
  moreHints: boolean
  onHint: () => void
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
      {moreHints && (
        <button type="button" className="ga-btn ga-btn--ghost ga-btn--sm mt-1.5 -ml-2" onClick={onHint}>
          <Lightbulb size={14} aria-hidden /> Stuck? Show me the next step
        </button>
      )}
    </>
  )
}

/** On narrow screens: the current milestone, pinned above the editor, opening to its goal and hints. */
function MilestoneStrip({ card, ticks, next, done, hintCount, moreHints, onHint }: MilestoneProps) {
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
          <CurrentDetails m={m} t={ticks?.[next]} hintCount={hintCount} moreHints={moreHints} onHint={onHint} />
        </div>
      )}
    </div>
  )
}

/** Run, the save note, and (beside the card) a handle to drag the editor/output split. */
function Toolbar({
  running,
  onRun,
  split,
  onSplit,
  box,
}: {
  running: boolean
  onRun: () => void
  split?: number
  onSplit?: (n: number) => void
  box?: React.RefObject<HTMLDivElement | null>
}) {
  const drag = (e: PointerEvent<HTMLDivElement>) => {
    if (!onSplit || !box?.current) return
    const pane = e.currentTarget.parentElement!.parentElement!
    const { top, height } = pane.getBoundingClientRect()
    e.currentTarget.setPointerCapture(e.pointerId)
    const move = (ev: globalThis.PointerEvent) => onSplit(clamp(((ev.clientY - top) / height) * 100))
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onSplit || split === undefined) return
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      onSplit(clamp(split + (e.key === 'ArrowUp' ? -5 : 5)))
    }
  }

  return (
    <div className="relative flex flex-none flex-wrap items-center gap-2 py-2.5">
      {onSplit && (
        <div
          className="ga-split-handle"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize the editor and output"
          aria-valuenow={Math.round(split ?? SPLIT_DEFAULT)}
          aria-valuemin={SPLIT_MIN}
          aria-valuemax={SPLIT_MAX}
          tabIndex={0}
          onPointerDown={drag}
          onKeyDown={key}
          onDoubleClick={() => onSplit(SPLIT_DEFAULT)}
          title="Drag to resize. Double-click to reset."
        />
      )}
      <RunButton onRun={onRun} running={running} />
      <span className="text-caption text-faint">Saved as you type.</span>
      <span className="ml-auto hidden text-caption text-faint sm:inline">
        <span className="ga-kbd">⌘</span> <span className="ga-kbd">↵</span> to check milestones
      </span>
    </div>
  )
}

const clamp = (n: number) => Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, n))

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
