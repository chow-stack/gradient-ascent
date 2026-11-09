import { ArrowRight, Flame, Home, ListChecks, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { startOfTomorrow, useNextDayCountdown, type DayKey } from '../../lib/dates'
import { prepareFreshTasks } from '../fresh/fresh'
import type { DailyResult } from '../../lib/db'
import { useProgress } from '../progress/progress'
import { DailyReview } from './DailyReview'
import { DailySteps } from './DailyTiles'
import { nextLesson } from './plan'

const STEP_MS = 240
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The finish: tiles flip over one by one while Adam climbs them to the top. */
export function DailyDone({ day, results, xp }: { day: DayKey; results: DailyResult[]; xp: number }) {
  const progress = useProgress()
  const countdown = useNextDayCountdown()
  // Tomorrow's coding tasks, written now so they're ready first thing.
  useEffect(() => void prepareFreshTasks(new Date(startOfTomorrow())), [])
  const last = results.length - 1
  const [at, setAt] = useState(() => (prefersReducedMotion() ? last : 0))
  useEffect(() => {
    if (at >= last) return
    const t = setTimeout(() => setAt(at + 1), STEP_MS)
    return () => clearTimeout(t)
  }, [at, last])

  // Reviewing the answers, and whether the finish has played (it doesn't replay on coming back).
  const [reviewing, setReviewing] = useState(false)
  const [replay, setReplay] = useState(true)
  const openReview = () => {
    setReplay(false)
    setReviewing(true)
  }
  const clean = results.filter((r) => r === 'clean').length
  const sweep = clean === results.length
  const upNext = progress ? nextLesson(progress.mastery) : undefined
  const streak = progress?.streak.current

  if (reviewing) return <DailyReview day={day} onBack={() => setReviewing(false)} />

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-[440px] flex-col items-center text-center">
        <DailySteps
          results={results}
          at={at}
          mood={at >= last ? 'happy' : 'idle'}
          flip={replay}
          wave={sweep && replay}
          stepMs={STEP_MS}
        />
        <div
          className={
            replay ? 'ga-settle mt-8 flex w-full flex-col items-center' : 'mt-8 flex w-full flex-col items-center'
          }
          style={{ animationDelay: `${results.length * STEP_MS + 80}ms` }}
        >
          <h1 className="text-display">{sweep ? 'Clean sweep' : `Daily ${results.length} done`}</h1>
          <p className="mt-3 flex items-center gap-5 font-semibold tabular-nums">
            {streak !== undefined && streak > 0 && (
              <span className="flex items-center gap-1.5">
                <Flame size={18} className="text-accent" aria-hidden /> {streak}-day streak
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Star size={18} className="text-xp" aria-hidden /> +{xp} XP
            </span>
          </p>
          <p className="mt-1.5 text-small text-muted tabular-nums">
            {clean} of {results.length} first try · Next in {countdown}
          </p>
          <div className="mt-8 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            {upNext && (
              <Link to="/session?kind=lesson" className="ga-btn ga-btn--primary min-w-0">
                <span className="truncate">Next: {upNext.title}</span>{' '}
                <ArrowRight size={16} className="flex-none" aria-hidden />
              </Link>
            )}
            <Link to="/" className={upNext ? 'ga-btn ga-btn--secondary' : 'ga-btn ga-btn--primary'}>
              <Home size={16} aria-hidden /> Today
            </Link>
          </div>
          <button type="button" className="ga-btn ga-btn--ghost mt-3" onClick={openReview}>
            <ListChecks size={16} aria-hidden /> Review answers
          </button>
        </div>
      </div>
    </div>
  )
}
