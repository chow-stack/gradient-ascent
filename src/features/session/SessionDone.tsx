import { ArrowRight, CalendarCheck, Dumbbell, Flame, Home, Star } from 'lucide-react'
import { Link } from 'react-router'
import { Adam } from '../../components/Adam'
import { useProgress, type CheckpointResult } from '../progress/progress'
import { nextLesson, type SessionKind } from './plan'

export type SessionSummary = {
  kind: SessionKind
  lessonId?: string
  lessonTitle?: string
  checkpoint?: CheckpointResult
  xp: number
  bonus: number
  correct: number
  total: number
  minutes: number
}

/** End of a lesson, checkpoint, review or practice session, and what's next. */
export function SessionDone({ summary }: { summary: SessionSummary }) {
  const progress = useProgress()
  const upNext = progress ? nextLesson(progress.mastery, progress.retakeTomorrow) : undefined
  const dailyPending = !!progress && progress.daily.total > 0 && !progress.daily.done
  const cp = summary.checkpoint
  const finishedLesson = !!summary.lessonTitle && summary.bonus > 0
  const title = cp
    ? cp.passed
      ? 'Checkpoint passed'
      : 'Not this time'
    : finishedLesson
      ? summary.lessonTitle
      : 'Nice climbing'
  const failedCheckpoint = !!cp && !cp.passed

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-[440px] flex-col items-center text-center">
        <Adam mood={failedCheckpoint ? 'think' : 'happy'} size={120} title="Adam" />
        <h1 className="mt-6 text-h1">{title}</h1>
        {failedCheckpoint && (
          <p className="mt-2 text-muted">
            {cp.correct} of {cp.total} right; you need {cp.needed}. Retake it tomorrow.
          </p>
        )}
        <p className="mt-3 flex items-center gap-5 font-semibold tabular-nums">
          {summary.total > 0 && (
            <span>
              {summary.correct}/{summary.total} right
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Star size={18} className="text-xp" aria-hidden /> +{summary.xp} XP
          </span>
          {!!progress?.streak.current && (
            <span className="flex items-center gap-1.5">
              <Flame size={18} className="text-accent" aria-hidden /> {progress.streak.current}
            </span>
          )}
        </p>

        <div className="mt-8 flex w-full flex-col gap-2">
          {dailyPending ? (
            <Link to="/session?kind=daily" className="ga-btn ga-btn--primary">
              <CalendarCheck size={16} aria-hidden /> Daily {progress.daily.total}
            </Link>
          ) : upNext ? (
            <Link to="/session?kind=lesson" className="ga-btn ga-btn--primary min-w-0">
              <span className="truncate">Next: {upNext.title}</span>
              <ArrowRight size={16} className="flex-none" aria-hidden />
            </Link>
          ) : null}
          <div className="flex justify-center gap-2">
            <Link to="/" className="ga-btn ga-btn--ghost">
              <Home size={16} aria-hidden /> Today
            </Link>
            {summary.lessonId && (
              <Link to={`/session?kind=practice&lesson=${summary.lessonId}`} className="ga-btn ga-btn--ghost">
                <Dumbbell size={16} aria-hidden /> Practice
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
