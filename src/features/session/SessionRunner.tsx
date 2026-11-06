import { Lightbulb, Star, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Adam, type AdamMood } from '../../components/Adam'
import type { DailyResult } from '../../lib/db'
import { SegmentedProgress } from '../../components/ui/ProgressBar'
import { ExerciseView } from '../exercises/ExerciseView'
import { canCheck, grade, initialAnswer, solutionFor, type Answer, type GradeResult } from '../exercises/grading'
import { inline } from '../exercises/inline'
import { type Phase } from '../exercises/types'
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
import { DailyTileRow } from './DailyTiles'
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
  const [idx, setIdx] = useState(0)
  const item = queue[Math.min(idx, queue.length - 1)]
  const [answer, setAnswer] = useState<Answer>(() => initialAnswer(item.card))
  const [phase, setPhase] = useState<Phase>('answering')
  const [result, setResult] = useState<GradeResult | undefined>()
  const [hintsUsed, setHintsUsed] = useState(0)
  const [shake, setShake] = useState(0)
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
  const isLearn = card.type === 'learn'
  const hints = 'hints' in card ? card.hints : []

  /** Save the outcome of the current item (runs in order, in the background). */
  const resolve = useCallback(
    (outcome: Outcome) => {
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
    [item, daily],
  )

  const finish = useCallback(async () => {
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
  }, [plan])

  const next = useCallback(() => {
    if (isLearn) resolve({ correct: true, firstTry: true, hintsUsed: 0, gaveUp: false })
    if (idx + 1 >= queueRef.current.length) {
      void finish()
      return
    }
    const nextItem = queueRef.current[idx + 1]
    setIdx(idx + 1)
    setAnswer(initialAnswer(nextItem.card))
    setPhase('answering')
    setResult(undefined)
    setHintsUsed(0)
    tries.current = 0
    startedAt.current = Date.now()
    window.scrollTo({ top: 0 })
  }, [idx, isLearn, resolve, finish])

  const check = useCallback(
    async (latest?: Answer) => {
      const current = latest ?? answer
      if (phase !== 'answering' || !canCheck(current)) return
      if (card.type === 'explain') {
        setPhase('revealed')
        return
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
    [phase, answer, card, hintsUsed, resolve],
  )

  const tryAgain = () => {
    setPhase('answering')
    setResult(undefined)
  }

  const reveal = () => {
    const s = solutionFor(card)
    if (s) setAnswer(s)
    setResult(undefined)
    setPhase('revealed')
    resolve({ correct: false, firstTry: false, hintsUsed, gaveUp: true })
  }

  const selfGrade = (level: 'missed' | 'partly' | 'nailed') => {
    resolve({ correct: level !== 'missed', firstTry: level === 'nailed', hintsUsed: 0, gaveUp: false })
    next()
  }

  /** Enter does whatever the main button says. */
  const primary = useCallback(
    (latest?: Answer) => {
      if (isLearn) return next()
      if (phase === 'answering') return void check(latest)
      if (phase === 'correct' || (phase === 'wrong' && card.type === 'choice')) return next()
      if (phase === 'revealed' && card.type !== 'explain') return next()
      if (phase === 'wrong') return tryAgain()
    },
    [isLearn, phase, card.type, next, check],
  )

  useEffect(() => {
    if (summary || dailyXp !== null) return
    const onKey = (e: KeyboardEvent) => {
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
  }, [primary, phase, summary, dailyXp])

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
    <div className="flex min-h-dvh flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur sm:px-6">
        <button type="button" aria-label="Exit session" className="ga-icon-btn" onClick={() => navigate('/')}>
          <X size={20} />
        </button>
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
        <span className="ga-chip text-xp" title="XP this session">
          <Star size={16} aria-hidden />
          <span className="sr-only">XP this session: </span>
          {xp}
        </span>
      </header>

      {/* Card */}
      <main className="flex flex-1 justify-center px-4 pt-8 pb-12 sm:px-8">
        <div key={item.key} className="flex w-full max-w-[760px] flex-col gap-5">
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
            className={phase === 'wrong' && card.type !== 'write' && card.type !== 'fix' ? 'ga-shake' : undefined}
          >
            <ExerciseView
              card={card}
              answer={answer}
              setAnswer={setAnswer}
              phase={phase}
              result={result?.run}
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
        <div className="mx-auto flex w-full max-w-[920px] items-center gap-4">
          <div className="hidden flex-none sm:block">
            <Adam mood={mood} size={56} />
          </div>
          <div key={`${item.key}-${phase}`} className="ga-feedback-in min-w-0 flex-1">
            <FooterText
              phase={phase}
              isLearn={isLearn}
              type={card.type}
              praise={praise}
              why={why}
              message={result?.message}
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
                  {phase === 'checking' ? 'Checking…' : card.type === 'explain' ? 'Compare' : 'Check'}
                  <span className="ga-kbd">↵</span>
                </button>
              </>
            ) : phase === 'revealed' && card.type === 'explain' ? (
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
    </div>
  )
}

function FooterText({
  phase,
  isLearn,
  type,
  praise,
  why,
  message,
}: {
  phase: Phase
  isLearn: boolean
  type: string
  praise: string
  why?: string
  message?: string
}) {
  if (isLearn) return <p className="ga-footer-body hidden text-muted sm:block">Read it, run it, then continue.</p>
  switch (phase) {
    case 'answering':
      return type === 'explain' ? (
        <p className="ga-footer-body hidden text-muted sm:block">Write it in your own words, then compare.</p>
      ) : null
    case 'checking':
      return <p className="ga-footer-body text-muted">Running your code…</p>
    case 'correct':
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
            {inline(type === 'choice' ? (why ?? '') : (message ?? 'Give it another go.'))}
          </p>
        </>
      )
    case 'revealed':
      return type === 'explain' ? (
        <>
          <p className="ga-footer-title">How close were you?</p>
          <p className="ga-footer-body text-muted">Be honest — it decides when this comes back.</p>
        </>
      ) : (
        <>
          <p className="ga-footer-title">Here’s a solution.</p>
          {why && <p className="ga-footer-body ga-prose mt-0.5">{inline(why)}</p>}
        </>
      )
  }
}
