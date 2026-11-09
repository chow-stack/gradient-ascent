import { ArrowRight, CalendarCheck, Check, Dumbbell, Flame, Home, RotateCcw, Star, X } from 'lucide-react'
import { Link } from 'react-router'
import { Adam } from '../../components/Adam'
import { RateLesson } from '../feedback/RateLesson'
import { useProgress, type CheckpointResult } from '../progress/progress'
import { nextLesson, type SessionKind } from './plan'

export type SessionSummary = {
  kind: SessionKind
  lessonId?: string
  lessonTitle?: string
  checkpoint?: CheckpointResult
  /** A checkpoint's questions, in the order they were asked, and whether each was right. */
  questions?: { label: string; code?: string; correct: boolean }[]
  xp: number
  bonus: number
  correct: number
  total: number
  minutes: number
}

/** End of a lesson, checkpoint, review or practice session, and what's next. */
export function SessionDone({ summary }: { summary: SessionSummary }) {
  const progress = useProgress()
  const upNext = progress ? nextLesson(progress.mastery) : undefined
  const dailyPending = !!progress && progress.daily.total > 0 && !progress.daily.done
  const cp = summary.checkpoint
  const finishedLesson = !!summary.lessonTitle && summary.bonus > 0
  const title = cp
    ? cp.passed
      ? 'Checkpoint passed'
      : 'Not passed yet'
    : finishedLesson
      ? summary.lessonTitle
      : 'Nice climbing'
  const failedCheckpoint = !!cp && !cp.passed

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-[440px] flex-col items-center text-center">
        <Adam mood={failedCheckpoint ? 'think' : 'happy'} size={120} title="Adam" />
        <h1 className="mt-6 text-h1">{title}</h1>
        {cp && (
          <p className="mt-2 text-muted">
            {cp.correct} of {cp.total} right ({Math.round((cp.correct / Math.max(1, cp.total)) * 100)}%). You need{' '}
            {cp.needed} to pass.
            {failedCheckpoint && ' Retake it whenever you’re ready: the questions change each time.'}
          </p>
        )}
        {summary.questions && summary.questions.length > 0 && (
          <ol className="ga-test-results mt-6 w-full text-left" aria-label="Your answers">
            {summary.questions.map((q, i) => (
              <li key={i} data-correct={q.correct}>
                <span className="w-6 flex-none text-faint tabular-nums">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate">
                  {q.label}
                  {q.code && <code className="ml-2 text-[12.5px] text-faint">{q.code}</code>}
                </span>
                {q.correct ? (
                  <Check size={16} className="flex-none text-success" aria-label="Right" />
                ) : (
                  <X size={16} className="flex-none text-danger" aria-label="Wrong" />
                )}
              </li>
            ))}
          </ol>
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

        {summary.kind === 'lesson' && summary.lessonId && (finishedLesson || cp) && (
          <div className="mt-8 w-full border-t border-border pt-6">
            <RateLesson lessonId={summary.lessonId} />
          </div>
        )}

        <div className="mt-8 flex w-full flex-col gap-2">
          {failedCheckpoint ? (
            <Link to="/session?kind=lesson" className="ga-btn ga-btn--primary">
              <RotateCcw size={16} aria-hidden /> Retake the checkpoint
            </Link>
          ) : dailyPending ? (
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
