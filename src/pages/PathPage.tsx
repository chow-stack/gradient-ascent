import { Check, Dumbbell, Lock, Play, Star } from 'lucide-react'
import { Link } from 'react-router'
import { tracks, lessonsForTrack } from '../features/content/content'
import { useProgress } from '../features/progress/progress'
import { lessonStatus, type LessonStatus } from '../features/session/plan'

const STATUS_LABEL: Record<LessonStatus, string> = {
  mastered: 'Mastered',
  passed: 'Passed',
  next: 'Up next',
  locked: 'Locked',
}

/** The skill path: every lesson in order, with where I am. */
export function PathPage() {
  const p = useProgress()
  if (!p) return <div className="min-h-[60vh]" aria-busy="true" />

  return (
    <div className="flex flex-col gap-8 pt-2">
      <header>
        <h1 className="text-h1">Path</h1>
        <p className="mt-2 max-w-[60ch] text-muted">
          One lesson unlocks the next. A lesson is <span className="text-success">passed</span> when you finish it, and{' '}
          <span className="text-xp">mastered</span> after you get it right again in a review on a later day.
        </p>
      </header>

      {tracks.map((track) =>
        track.units.map((unit) => {
          const unitLessons = lessonsForTrack(track.id).filter((l) => l.unit === unit.unit)
          return (
            <section
              key={`${track.id}-${unit.unit}`}
              aria-labelledby={`unit-${unit.unit}`}
              className="flex flex-col gap-3"
            >
              <div>
                <h2 id={`unit-${unit.unit}`} className="text-h2">
                  Unit {unit.unit}: {unit.title}
                </h2>
                <p className="mt-1 text-small text-muted">
                  {track.name} · {unit.summary}
                </p>
              </div>
              <ol className="flex flex-col gap-2">
                {unitLessons.map((lesson, i) => {
                  const status = lessonStatus(lesson, p.mastery)
                  return (
                    <li
                      key={lesson.id}
                      className="ga-card flex items-center gap-4 p-4"
                      data-status={status}
                      style={status === 'locked' ? { opacity: 0.6 } : undefined}
                    >
                      <StatusIcon status={status} n={i + 1} />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold">{lesson.title}</h3>
                        <p className="truncate text-small text-muted">{lesson.summary}</p>
                      </div>
                      <span className="hidden text-caption text-faint sm:inline">{STATUS_LABEL[status]}</span>
                      {status === 'next' && (
                        <Link to="/session?kind=lesson" className="ga-btn ga-btn--primary ga-btn--sm">
                          <Play size={14} aria-hidden /> Start
                        </Link>
                      )}
                      {(status === 'passed' || status === 'mastered') && (
                        <Link
                          to={`/session?kind=practice&lesson=${lesson.id}`}
                          className="ga-btn ga-btn--secondary ga-btn--sm"
                          aria-label={`Practice ${lesson.title}`}
                        >
                          <Dumbbell size={14} aria-hidden /> <span className="hidden sm:inline">Practice</span>
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ol>
            </section>
          )
        }),
      )}
    </div>
  )
}

function StatusIcon({ status, n }: { status: LessonStatus; n: number }) {
  const base = 'grid size-10 flex-none place-items-center rounded-full font-semibold tabular-nums'
  switch (status) {
    case 'mastered':
      return (
        <span className={`${base} bg-xp text-on-accent`} aria-hidden>
          <Star size={18} fill="currentColor" />
        </span>
      )
    case 'passed':
      return (
        <span className={`${base} bg-success text-on-success`} aria-hidden>
          <Check size={18} strokeWidth={3} />
        </span>
      )
    case 'next':
      return (
        <span className={`${base} bg-accent text-on-accent`} aria-hidden>
          {n}
        </span>
      )
    case 'locked':
      return (
        <span className={`${base} bg-raised text-faint`} aria-hidden>
          <Lock size={16} />
        </span>
      )
  }
}
