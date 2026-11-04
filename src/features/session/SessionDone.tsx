import { ArrowRight, Check, Dumbbell, Flame, Home, Layers, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Adam } from '../../components/Adam'
import { useProgress } from '../progress/progress'
import { nextLesson, type SessionKind } from './plan'

export type SessionSummary = {
  kind: SessionKind
  lessonId?: string
  lessonTitle?: string
  xp: number
  bonus: number
  correct: number
  total: number
  minutes: number
}

/** "Done for today" + the keep-going options. */
export function SessionDone({ summary }: { summary: SessionSummary }) {
  const progress = useProgress()
  const upNext = progress ? nextLesson(progress.mastery) : undefined
  const core = summary.kind === 'core'

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-[560px] flex-col items-center gap-7 text-center">
        <Adam mood="happy" size={140} title="Adam, celebrating" />
        <div>
          <h1 className="text-display leading-tight">{core ? 'Done for today' : 'Nice climbing'}</h1>
          <p className="mt-2 text-muted">
            {summary.lessonTitle && summary.bonus > 0
              ? `You finished “${summary.lessonTitle}”. It will come back in your reviews.`
              : core
                ? 'Your streak is safe. Anything more is a bonus.'
                : 'Every rep makes the next review easier.'}
          </p>
        </div>

        <div className="grid w-full grid-cols-3 gap-3">
          <Stat icon={<Star size={18} />} color="var(--color-xp)" value={`+${summary.xp}`} label="XP" />
          <Stat
            icon={<Check size={18} />}
            color="var(--color-success)"
            value={summary.total ? `${summary.correct}/${summary.total}` : '—'}
            label="Correct"
          />
          <Stat
            icon={<Flame size={18} />}
            color="var(--color-accent)"
            value={progress ? String(progress.streak.current) : '…'}
            label="Day streak"
          />
        </div>

        <div className="flex w-full flex-col gap-2">
          <h2 className="text-small font-semibold text-muted">Keep going?</h2>
          <div className="flex flex-col gap-2">
            {upNext && (
              <KeepGoing
                to="/session?kind=lesson"
                icon={<ArrowRight size={18} />}
                title={`Next lesson: ${upNext.title}`}
              />
            )}
            {summary.lessonId && (
              <KeepGoing
                to={`/session?kind=practice&lesson=${summary.lessonId}`}
                icon={<Dumbbell size={18} />}
                title="Practice this lesson again"
              />
            )}
            {progress && progress.reviewCount > 0 && (
              <KeepGoing to="/session?kind=review" icon={<Layers size={18} />} title="Extra reviews" />
            )}
          </div>
        </div>

        <Link to="/" className="ga-btn ga-btn--primary w-full sm:w-auto">
          <Home size={16} aria-hidden /> Back to Today
        </Link>
      </div>
    </div>
  )
}

function KeepGoing({ to, icon, title }: { to: string; icon: ReactNode; title: string }) {
  return (
    <Link to={to} className="ga-choice text-left">
      <span className="ga-choice-key text-sky">{icon}</span>
      <span>{title}</span>
    </Link>
  )
}

function Stat({ icon, value, label, color }: { icon: ReactNode; value: string; label: string; color: string }) {
  return (
    <div className="ga-card flex flex-col items-center gap-1 px-3 py-4">
      <span className="flex items-center gap-1.5 text-[22px] font-semibold tabular-nums" style={{ color }}>
        <span aria-hidden className="flex">
          {icon}
        </span>
        {value}
      </span>
      <span className="text-caption text-muted">{label}</span>
    </div>
  )
}
