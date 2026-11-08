import { BookOpen, Bug, Lightbulb, Star, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Adam, type AdamMood } from '../../components/Adam'
import { db, type DailyResult } from '../../lib/db'
import { debugPanelOpen, saveDebugPanelOpen, WIDE } from '../../lib/debug'
import { checkExplanation, GeminiError, getGeminiKey } from '../ai/gemini'
import { SegmentedProgress } from '../../components/ui/ProgressBar'
import { ExerciseView } from '../exercises/ExerciseView'
import { cardVariants } from '../content/schema'
import { loadDraft } from '../exercises/drafts'
import { canCheck, grade, initialAnswer, solutionFor, type Answer, type GradeResult } from '../exercises/grading'
import { inline } from '../exercises/inline'
import { type AiState, type Phase } from '../exercises/types'
import {
  completeCheckpoint,
  completeLesson,
  countDayIfNothingToReview,
  dailyResult,
  recordAttempt,
  recordDailyResult,
} from '../progress/progress'
import { DAILY_COMPLETE_BONUS, type Outcome } from '../progress/xp'
import { DailyDone } from './DailyDone'
import { DebugPanel } from './DebugPanel'
import { DailyTileRow } from './DailyTiles'
import { NotesDialog } from './LessonNotes'
import type { SessionItem, SessionPlan } from './plan'
import { SessionDone, type SessionSummary } from './SessionDone'

const PRAISE = ['Nice — that’s right.', 'Correct.', 'Yes! Exactly.', 'Nailed it.']

/** Plays a session: one card at a time, check → feedback → continue, saving every result. */
export function SessionRunner({ plan }: { plan: SessionPlan }) {
  const navigate = useNavigate()
  const [queue, setQueue] = useState<SessionItem[]>(plan.items)
  // Refs mirror state that event handlers must read synchronously (retries, totals for the summary).
  const queueRef = useRef(plan.items)
  const totals = useRef({ xp: 0, correct: 0, graded: 0 })
  // Checkpoint score: right without hints or "show answer" (warm-up reviews don't count).
  const checkpoint = useRef({ correct: 0, total: 0 })
  // Debug sessions open any lesson at any card, can jump around, and save nothing.
  const debug = plan.kind === 'debug'
  const [idx, setIdx] = useState(plan.startAt ?? 0)
  const [panelOpen, setPanelOpen] = useState(() => debug && debugPanelOpen())
  const showPanel = (open: boolean) => {
    setPanelOpen(open)
    if (window.matchMedia(WIDE).matches) saveDebugPanelOpen(open)
  }
  const item = queue[Math.min(idx, queue.length - 1)]
  const [answer, setAnswer] = useState<Answer>(() => startAnswer(item, debug))
  const [phase, setPhase] = useState<Phase>('answering')
  const [result, setResult] = useState<GradeResult | undefined>()
  const [hintsUsed, setHintsUsed] = useState(0)
  const [shake, setShake] = useState(0)
  // Explain cards: the AI's grade, whether the learner grades themselves instead, and a saved disagreement.
  const [ai, setAi] = useState<AiState>({ status: 'off' })
  const [selfGrading, setSelfGrading] = useState(false)
  const dispute = useRef<number | undefined>(undefined)
  const aiRequest = useRef(0)
  const tries = useRef(0)
  const startedAt = useRef(0)
  const sessionStart = useRef(0)
  useEffect(() => {
    startedAt.current = Date.now()
    sessionStart.current = Date.now()
  }, [])
  const saving = useRef<Promise<unknown>>(Promise.resolve())
  const retried = useRef(new Set<string>())
  const [xp, setXp] = useState(0)
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const daily = plan.daily
  const [dailyResults, setDailyResults] = useState<Record<string, DailyResult>>(daily?.results ?? {})
  const [dailyXp, setDailyXp] = useState<number | null>(null)
  const tiles = daily?.itemIds.map((id) => dailyResults[id] ?? null)
  const [praise] = useState(() => PRAISE[Math.floor(Math.random() * PRAISE.length)])

  const card = item.card
  const fullHeight = card.type === 'project'
  const isLearn = card.type === 'learn'
  const hints = 'hints' in card ? card.hints : []
  const [reading, setReading] = useState(false)
  const notes = rereadable(item)

  /** Save the outcome of the current item (runs in order, in the background). */
  const resolve = useCallback(
    (outcome: Outcome) => {
      if (debug) return
      const it = item
      const durationMs = Date.now() - startedAt.current
      if (it.card.type !== 'learn') {
        totals.current.graded += 1
        if (outcome.correct) totals.current.correct += 1
      }
      if (it.source === 'checkpoint') {
        checkpoint.current.total += 1
        if (outcome.correct && !outcome.gaveUp && outcome.hintsUsed === 0) checkpoint.current.correct += 1
      }
      saving.current = saving.current
        .then(() =>
          recordAttempt({
            itemId: it.itemId,
            lessonId: it.lesson.id,
            type: it.card.type,
            source: it.source,
            outcome,
            durationMs,
          }),
        )
        .then((gained) => {
          totals.current.xp += gained
          setXp(totals.current.xp)
        })
        .catch(console.error)
      if (daily) {
        const r = dailyResult(outcome)
        setDailyResults((prev) => ({ ...prev, [it.itemId]: r }))
        saving.current = saving.current.then(() => recordDailyResult(daily.day, it.itemId, r)).catch(console.error)
      }
      // Missed lesson items come back once at the end (they don't touch the review schedule again).
      const missed = !outcome.correct || outcome.gaveUp
      if (missed && it.source === 'lesson' && !retried.current.has(it.key)) {
        retried.current.add(it.key)
        queueRef.current = [...queueRef.current, { ...it, key: `${it.key}:retry`, source: 'retry' }]
        setQueue(queueRef.current)
      }
    },
    [item, daily, debug],
  )

  const finish = useCallback(async () => {
    if (debug) return void navigate('/debug')
    await saving.current
    if (plan.daily) {
      setDailyXp(totals.current.xp + DAILY_COMPLETE_BONUS)
      return
    }
    const lessonDone =
      !!plan.lessonId &&
      plan.kind === 'lesson' &&
      plan.items.some((i) => i.source === 'lesson' || i.source === 'project')
    const checkpointDone = !!plan.lessonId && plan.items.some((i) => i.source === 'checkpoint')
    const cp = checkpointDone
      ? await completeCheckpoint(plan.lessonId!, checkpoint.current.correct, checkpoint.current.total)
      : undefined
    const bonus = lessonDone ? await completeLesson(plan.lessonId!) : (cp?.bonus ?? 0)
    if (plan.kind === 'lesson') await countDayIfNothingToReview()
    setSummary({
      kind: plan.kind,
      lessonId: plan.lessonId,
      lessonTitle: plan.items.find((i) => i.source !== 'review' && i.source !== 'practice')?.lesson.title,
      checkpoint: cp,
      xp: totals.current.xp + bonus,
      bonus,
      correct: totals.current.correct,
      total: totals.current.graded,
      minutes: Math.max(1, Math.round((Date.now() - sessionStart.current) / 60000)),
    })
  }, [plan, debug, navigate])

  /** Show item i fresh. In debug mode, `version` picks one of the card's variants (0 is the card itself). */
  const goTo = useCallback(
    (i: number, version = 0) => {
      let target = queueRef.current[i]
      if (debug) {
        const base = target.lesson.cards[i]
        const card = version > 0 ? (cardVariants(base)[version - 1] ?? base) : base
        target = { ...target, card, key: `debug:${target.itemId}:v${version}` }
        queueRef.current = queueRef.current.map((q, k) => (k === i ? target : q))
        setQueue(queueRef.current)
      }
      setIdx(i)
      setAnswer(startAnswer(target, debug))
      setPhase('answering')
      setResult(undefined)
      setHintsUsed(0)
      setAi({ status: 'off' })
      setSelfGrading(false)
      dispute.current = undefined
      aiRequest.current += 1
      tries.current = 0
      startedAt.current = Date.now()
      window.scrollTo({ top: 0 })
    },
    [debug],
  )

  const next = useCallback(() => {
    if (isLearn) resolve({ correct: true, firstTry: true, hintsUsed: 0, gaveUp: false })
    // The AI said nailed or partly, and the learner accepted it.
    if (card.type === 'explain' && phase === 'correct' && !selfGrading)
      resolve({
        correct: true,
        firstTry: ai.status === 'done' && ai.check.verdict === 'nailed' && tries.current === 1,
        hintsUsed,
        gaveUp: false,
      })
    if (idx + 1 >= queueRef.current.length) {
      void finish()
      return
    }
    goTo(idx + 1)
  }, [idx, isLearn, resolve, finish, card.type, phase, selfGrading, ai, hintsUsed, goTo])

  /** Ask the AI to grade an explanation. With no key, offline, or on an error, the learner grades themselves. */
  const askAi = useCallback(
    async (text: string) => {
      if (card.type !== 'explain') return
      const key = getGeminiKey()
      if (!key || !navigator.onLine) {
        setAi(key ? { status: 'failed', message: 'You’re offline, so the AI can’t check this.' } : { status: 'off' })
        setSelfGrading(true)
        setPhase('revealed')
        return
      }
      const request = ++aiRequest.current
      setAi({ status: 'checking' })
      setSelfGrading(false)
      setPhase('checking')
      try {
        const c = await checkExplanation(card, text, key)
        if (request !== aiRequest.current) return
        setAi({ status: 'done', check: c })
        if (c.verdict === 'missed') {
          setPhase('wrong')
          setShake((s) => s + 1)
        } else setPhase('correct')
      } catch (e) {
        if (request !== aiRequest.current) return
        setAi({ status: 'failed', message: e instanceof GeminiError ? e.message : 'The AI check didn’t work.' })
        setSelfGrading(true)
        setPhase('revealed')
      }
    },
    [card],
  )

  const check = useCallback(
    async (latest?: Answer) => {
      const current = latest ?? answer
      if (phase !== 'answering' || !canCheck(current)) return
      if (card.type === 'explain' && current.type === 'explain') {
        tries.current += 1
        return void askAi(current.text)
      }
      setPhase('checking')
      tries.current += 1
      const g = await grade(card, current)
      setResult(g)
      if (g.correct) {
        setPhase('correct')
        resolve({ correct: true, firstTry: tries.current === 1, hintsUsed, gaveUp: false })
      } else {
        setPhase('wrong')
        setShake((s) => s + 1)
        if (card.type === 'choice') resolve({ correct: false, firstTry: true, hintsUsed, gaveUp: false })
      }
    },
    [phase, answer, card, hintsUsed, resolve, askAi],
  )

  const tryAgain = () => {
    setPhase('answering')
    setResult(undefined)
    setAi({ status: 'off' })
  }

  /** The learner thinks the AI graded them wrongly: save that, and let them pick their own grade. */
  const disputeAi = () => {
    if (ai.status !== 'done' || answer.type !== 'explain') return
    setSelfGrading(true)
    setPhase('revealed')
    if (debug) return
    const it = item
    void db.disputes
      .add({
        itemId: it.itemId,
        lessonId: it.lesson.id,
        at: Date.now(),
        answer: answer.text,
        aiVerdict: ai.check.verdict,
      })
      .then((id) => (dispute.current = id))
      .catch(console.error)
  }

  const reveal = () => {
    const s = solutionFor(card)
    if (s) setAnswer(s)
    setResult(undefined)
    setPhase('revealed')
    resolve({ correct: false, firstTry: false, hintsUsed, gaveUp: true })
  }

  const selfGrade = (level: 'missed' | 'partly' | 'nailed') => {
    const id = dispute.current
    if (id !== undefined) void db.disputes.update(id, { myVerdict: level }).catch(console.error)
    resolve({ correct: level !== 'missed', firstTry: level === 'nailed', hintsUsed: 0, gaveUp: false })
    next()
  }

  /** Enter does whatever the main button says. */
  const primary = useCallback(
    (latest?: Answer) => {
      if (isLearn) return next()
      if (phase === 'answering') return void check(latest)
      if (phase === 'correct' || (phase === 'wrong' && card.type === 'choice')) return next()
      if (phase === 'revealed' && !(card.type === 'explain' && selfGrading)) return next()
      if (phase === 'wrong') return tryAgain()
    },
    [isLearn, phase, card.type, selfGrading, next, check],
  )

  useEffect(() => {
    if (summary || dailyXp !== null || reading) return
    const onKey = (e: KeyboardEvent) => {
      if (debug && e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const to = idx + (e.key === 'ArrowLeft' ? -1 : 1)
        if (to >= 0 && to < queueRef.current.length) goTo(to)
        e.preventDefault()
        return
      }
      const t = (e.target instanceof HTMLElement ? e.target : document.body) as HTMLElement
      const inEditor = !!t.closest('.monaco-editor')
      const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || inEditor
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        if (inEditor) return // the editor sends its own submit, with its latest text
        e.preventDefault()
        return primary()
      }
      // After checking, fields are read-only, so plain Enter means "continue" everywhere.
      if (e.key === 'Enter' && inField && phase !== 'answering' && phase !== 'checking') {
        e.preventDefault()
        return primary()
      }
      if (inField) return
      if (e.key === 'Enter' && t.tagName !== 'BUTTON') {
        e.preventDefault()
        return primary()
      }
      if (phase === 'answering' && /^[1-4]$/.test(e.key))
        document.querySelector<HTMLButtonElement>(`[data-choices] [data-key="${e.key}"]`)?.click()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [primary, phase, summary, dailyXp, reading, debug, idx, goTo])

  if (summary) return <SessionDone summary={summary} />
  if (dailyXp !== null && tiles) return <DailyDone results={tiles.map((r) => r ?? 'missed')} xp={dailyXp} />

  const mood: AdamMood =
    phase === 'correct'
      ? 'happy'
      : phase === 'wrong'
        ? 'oops'
        : phase === 'checking' || (hintsUsed > 0 && phase === 'answering')
          ? 'think'
          : 'idle'
  const done = idx + (phase === 'answering' || phase === 'checking' ? 0 : 1)
  const why = 'why' in card ? card.why : undefined
  const footerState = phase === 'correct' ? 'correct' : phase === 'wrong' ? 'wrong' : undefined

  return (
    <div
      className={[
        // A project fills the screen exactly, so its panels scroll instead of the page.
        fullHeight ? 'flex h-dvh flex-col' : 'flex min-h-dvh flex-col',
        debug && panelOpen ? 'lg:pl-[var(--ga-debug-w)]' : '',
      ].join(' ')}
    >
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur sm:px-6">
        <button
          type="button"
          aria-label="Exit session"
          className="ga-icon-btn"
          onClick={() => navigate(debug ? '/debug' : '/')}
        >
          <X size={20} />
        </button>
        {debug && !panelOpen && (
          <button
            type="button"
            className="ga-debug-open"
            aria-label="Show debug panel"
            title="Show debug panel"
            onClick={() => showPanel(true)}
          >
            <Bug size={15} aria-hidden />
            <span className="tabular-nums">
              {idx + 1}/{queue.length}
            </span>
          </button>
        )}
        <div className="min-w-0 flex-1">
          {tiles ? (
            <DailyTileRow results={tiles} />
          ) : (
            <SegmentedProgress
              total={queue.length}
              done={isLearn ? idx : done}
              current={phase === 'answering' ? idx : undefined}
              label="Session progress"
            />
          )}
        </div>
        {notes.length > 0 && (
          <button
            type="button"
            className="ga-btn ga-btn--ghost ga-btn--sm flex-none"
            aria-label="Reread the lesson"
            onClick={() => setReading(true)}
          >
            <BookOpen size={16} aria-hidden /> <span className="hidden sm:inline">Reread</span>
          </button>
        )}
        <span className="ga-chip text-xp" title="XP this session">
          <Star size={16} aria-hidden />
          <span className="sr-only">XP this session: </span>
          {xp}
        </span>
      </header>

      {debug && panelOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
            aria-label="Hide debug panel"
            onClick={() => showPanel(false)}
          />
          <DebugPanel
            items={queue}
            idx={idx}
            version={debugVersion(item)}
            onGo={(i, v) => {
              goTo(i, v)
              if (!window.matchMedia(WIDE).matches) showPanel(false)
            }}
            onClose={() => showPanel(false)}
          />
        </>
      )}

      {/* Card */}
      <main
        className={
          fullHeight
            ? 'flex min-h-0 flex-1 justify-center px-4 pt-4 pb-4 sm:px-6'
            : 'flex flex-1 justify-center px-4 pt-8 pb-12 sm:px-8'
        }
      >
        <div
          key={item.key}
          className={
            fullHeight
              ? 'flex min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-3'
              : 'flex w-full max-w-[760px] flex-col gap-5'
          }
        >
          {item.source !== 'lesson' && !daily && (
            <p className="text-caption text-faint">
              {item.source === 'checkpoint'
                ? `Checkpoint · no hints, 80% to pass`
                : item.source === 'project'
                  ? item.lesson.title
                  : `${item.source === 'review' ? 'Review' : item.source === 'retry' ? 'One more try' : 'Practice'} · ${item.lesson.title}`}
            </p>
          )}
          <div
            key={shake}
            className={
              fullHeight
                ? 'flex min-h-0 flex-1 flex-col'
                : phase === 'wrong' && card.type !== 'write' && card.type !== 'fix'
                  ? 'ga-shake'
                  : undefined
            }
          >
            <ExerciseView
              card={card}
              answer={answer}
              setAnswer={setAnswer}
              phase={phase}
              result={result?.run}
              milestones={result?.milestones}
              draftKey={card.type === 'project' && item.source === 'project' && !debug ? item.itemId : undefined}
              ai={ai}
              selfGrading={selfGrading}
              onRetryAi={answer.type === 'explain' ? () => void askAi(answer.text) : undefined}
              onSubmit={primary}
            />
          </div>
          {hintsUsed > 0 && phase !== 'revealed' && (
            <div className="ga-hint ga-feedback-in flex flex-col gap-2">
              {hints.slice(0, hintsUsed).map((h, i) => (
                <p key={i} className="ga-prose flex gap-3">
                  <Lightbulb size={18} className="mt-0.5 flex-none text-sky" aria-hidden />
                  <span>{inline(h)}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Feedback footer */}
      <footer className="ga-footer sticky bottom-0" data-state={footerState} aria-live="polite">
        <div className={`mx-auto flex w-full items-center gap-4 ${fullHeight ? 'max-w-[1400px]' : 'max-w-[920px]'}`}>
          <div className="hidden flex-none sm:block">
            <Adam mood={mood} size={56} />
          </div>
          <div key={`${item.key}-${phase}`} className="ga-feedback-in min-w-0 flex-1">
            <FooterText
              phase={phase}
              learnHint={
                isLearn ? (card.code ? 'Read it, run it, then continue.' : 'Read it, then continue.') : undefined
              }
              type={card.type}
              praise={praise}
              why={why}
              message={result?.message}
              verdict={ai.status === 'done' ? ai.check.verdict : undefined}
              selfGrading={selfGrading}
            />
          </div>
          <div className="flex flex-none flex-wrap items-center justify-end gap-2">
            {isLearn ? (
              <button type="button" className="ga-btn ga-btn--primary" onClick={next}>
                Continue <span className="ga-kbd">↵</span>
              </button>
            ) : phase === 'answering' || phase === 'checking' ? (
              <>
                {hints.length > 0 && (
                  <button
                    type="button"
                    className="ga-btn ga-btn--ghost"
                    disabled={hintsUsed >= hints.length || phase === 'checking'}
                    onClick={() => setHintsUsed((h) => h + 1)}
                  >
                    <Lightbulb size={16} aria-hidden />
                    <span className="hidden sm:inline">
                      Hint{hints.length > 1 ? ` ${Math.min(hintsUsed + 1, hints.length)}/${hints.length}` : ''}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  className="ga-btn ga-btn--primary"
                  disabled={!canCheck(answer) || phase === 'checking'}
                  onClick={() => void check()}
                >
                  {phase === 'checking' ? 'Checking…' : 'Check'}
                  <span className="ga-kbd">↵</span>
                </button>
              </>
            ) : card.type === 'explain' && ai.status === 'done' && (phase === 'correct' || phase === 'wrong') ? (
              <>
                <button type="button" className="ga-btn ga-btn--ghost ga-btn--sm" onClick={disputeAi}>
                  AI got it wrong
                </button>
                {phase === 'wrong' && (
                  <button type="button" className="ga-btn ga-btn--ghost" onClick={reveal}>
                    Show answer
                  </button>
                )}
                <button
                  type="button"
                  autoFocus
                  className={phase === 'correct' ? 'ga-btn ga-btn--success' : 'ga-btn ga-btn--danger'}
                  onClick={phase === 'correct' ? next : tryAgain}
                >
                  {phase === 'wrong' ? 'Try again' : idx + 1 >= queue.length ? 'Finish' : 'Continue'}{' '}
                  <span className="ga-kbd">↵</span>
                </button>
              </>
            ) : phase === 'revealed' && card.type === 'explain' && selfGrading ? (
              <>
                <button
                  type="button"
                  className="ga-btn ga-btn--secondary ga-btn--sm"
                  onClick={() => selfGrade('missed')}
                >
                  Missed it
                </button>
                <button
                  type="button"
                  className="ga-btn ga-btn--secondary ga-btn--sm"
                  onClick={() => selfGrade('partly')}
                >
                  Partly
                </button>
                <button type="button" className="ga-btn ga-btn--success ga-btn--sm" onClick={() => selfGrade('nailed')}>
                  Nailed it
                </button>
              </>
            ) : phase === 'wrong' && card.type !== 'choice' ? (
              <>
                <button type="button" className="ga-btn ga-btn--ghost" onClick={reveal}>
                  Show answer
                </button>
                <button type="button" autoFocus className="ga-btn ga-btn--danger" onClick={tryAgain}>
                  Try again <span className="ga-kbd">↵</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                autoFocus
                className={
                  phase === 'correct'
                    ? 'ga-btn ga-btn--success'
                    : phase === 'wrong'
                      ? 'ga-btn ga-btn--danger'
                      : 'ga-btn ga-btn--primary'
                }
                onClick={next}
              >
                {idx + 1 >= queue.length ? 'Finish' : 'Continue'} <span className="ga-kbd">↵</span>
              </button>
            )}
          </div>
        </div>
      </footer>
      {reading && <NotesDialog title={item.lesson.title} cards={notes} onClose={() => setReading(false)} />}
    </div>
  )
}

/** A project picks up from the learner's saved draft. Practising a project, or debugging it, starts it fresh. */
function startAnswer(item: SessionItem, debug = false): Answer {
  const draft = item.card.type === 'project' && item.source === 'project' && !debug ? loadDraft(item.itemId) : null
  return draft ? { type: 'code', code: draft } : initialAnswer(item.card)
}

/**
 * What can be reread from this card: in a first pass, the teaching so far; in practice or a retry, all of it.
 * Daily sets, reviews and checkpoints stay closed-book, because recalling unaided is what they're for.
 */
function rereadable(item: SessionItem) {
  const { cards } = item.lesson
  if (item.source === 'lesson' || item.source === 'project') {
    const upTo = cards.findIndex((c) => c.id === item.card.id)
    return cards.slice(0, upTo + 1).filter((c) => c.type === 'learn')
  }
  if (item.source === 'practice' || item.source === 'retry') return cards.filter((c) => c.type === 'learn')
  return []
}

function FooterText({
  phase,
  learnHint,
  type,
  praise,
  why,
  message,
  verdict,
  selfGrading,
}: {
  phase: Phase
  learnHint?: string
  type: string
  praise: string
  why?: string
  message?: string
  verdict?: 'nailed' | 'partly' | 'missed'
  selfGrading?: boolean
}) {
  if (learnHint) return <p className="ga-footer-body hidden text-muted sm:block">{learnHint}</p>
  switch (phase) {
    case 'answering':
      return type === 'explain' ? (
        <p className="ga-footer-body hidden text-muted sm:block">Write it in your own words, then check.</p>
      ) : null
    case 'checking':
      return (
        <p className="ga-footer-body text-muted">
          {type === 'explain' ? 'The AI is reading your answer…' : 'Running your code…'}
        </p>
      )
    case 'correct':
      if (type === 'explain')
        return (
          <>
            <p className="ga-footer-title">{verdict === 'partly' ? 'Partly right.' : 'Nailed it.'}</p>
            <p className="ga-footer-body text-muted mt-0.5">
              {verdict === 'partly' ? 'Check the points you missed, then carry on.' : 'Every key point is there.'}
            </p>
          </>
        )
      return (
        <>
          <p className="ga-footer-title">{praise}</p>
          {why && <p className="ga-footer-body ga-prose mt-0.5">{inline(why)}</p>}
        </>
      )
    case 'wrong':
      return (
        <>
          <p className="ga-footer-title">Not quite.</p>
          <p className="ga-footer-body ga-prose mt-0.5">
            {inline(
              type === 'choice'
                ? (why ?? '')
                : type === 'explain'
                  ? 'The checklist shows what’s missing. Try again in your own words.'
                  : (message ?? 'Give it another go.'),
            )}
          </p>
        </>
      )
    case 'revealed':
      if (type === 'explain' && !selfGrading)
        return (
          <>
            <p className="ga-footer-title">Here’s a good answer.</p>
            <p className="ga-footer-body text-muted">This one comes back once at the end.</p>
          </>
        )
      return type === 'explain' ? (
        <>
          <p className="ga-footer-title">How close were you?</p>
          <p className="ga-footer-body text-muted">Missed it brings this back once at the end.</p>
        </>
      ) : (
        <>
          <p className="ga-footer-title">Here’s a solution.</p>
          {why && <p className="ga-footer-body ga-prose mt-0.5">{inline(why)}</p>}
        </>
      )
  }
}

/** Which version of its card a debug item shows (0 is the card itself). */
const debugVersion = (item: SessionItem) => Number(/:v(\d+)$/.exec(item.key)?.[1] ?? 0)
