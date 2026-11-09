import { ArrowRight, Check, Layers, Play, Snowflake } from 'lucide-react'
import { Link } from 'react-router'
import { Card } from '../components/ui/Card'
import { ProgressBar } from '../components/ui/ProgressBar'
import { lessons, tracks } from '../features/content/content'
import { useProgress, type ProgressSnapshot } from '../features/progress/progress'
import { DailySteps } from '../features/session/DailyTiles'
import { nextLesson } from '../features/session/plan'
import { loadResume } from '../features/session/resume'
import { addDays, dayKey, useNextDayCountdown, weekStart } from '../lib/dates'

/** Today: the Daily 5, the next lesson, and the week. */
export function HomePage() {
  const p = useProgress()
  if (!p) return <div className="min-h-[60vh]" aria-busy="true" />
  const dailyPending = p.daily.total > 0 && !p.daily.done

  return (
    <div className="flex flex-col gap-4 pt-2">
      <DailyCard p={p} />
      <LessonCard p={p} primary={!dailyPending} />
      <StreakWeek p={p} />
      {p.daily.done && p.reviewCount > 0 && (
        <Link to="/session?kind=review" className="ga-btn ga-btn--ghost ga-btn--sm self-start">
          <Layers size={14} aria-hidden /> Extra reviews
        </Link>
      )}
    </div>
  )
}

function DailyCard({ p }: { p: ProgressSnapshot }) {
  const { total, results, done } = p.daily
  const countdown = useNextDayCountdown()
  const answered = results.filter(Boolean).length
  const shown = total > 0 ? results : Array<null>(5).fill(null)
  const started = answered > 0

  return (
    <section className="ga-card flex flex-col-reverse gap-6 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
      <div className="flex min-w-0 flex-col items-start gap-1">
        <h1 className="text-h1">Daily {total || 5}</h1>
        {done ? (
          <p className="text-muted tabular-nums">Done · Next in {countdown}</p>
        ) : total === 0 ? (
          <p className="text-muted">
            {p.reviewCount === 0 ? 'Starts after your first lesson.' : 'Nothing to review today.'}
          </p>
        ) : (
          <>
            <p className="text-muted tabular-nums">{started ? `${answered} of ${total} done` : 'About 5 min'}</p>
            <Link to="/session?kind=daily" className="ga-btn ga-btn--primary mt-4">
              <Play size={16} aria-hidden /> {started ? 'Continue' : 'Start'}
            </Link>
          </>
        )}
      </div>
      <DailySteps
        results={shown}
        at={Math.min(answered, shown.length - 1)}
        mood={done ? 'happy' : 'idle'}
        resting={total === 0}
        className="flex-none self-center sm:self-auto"
      />
    </section>
  )
}

function LessonCard({ p, primary }: { p: ProgressSnapshot; primary: boolean }) {
  const lesson = nextLesson(p.mastery)
  if (!lesson)
    return (
      <Card className="flex items-center gap-3">
        <Check size={18} className="text-success" aria-hidden />
        <p className="text-muted">You’ve finished every lesson so far.</p>
      </Card>
    )
  const inUnit = lessons.filter((l) => l.unit === lesson.unit)
  const passed = inUnit.filter((l) => p.mastery.has(l.id)).length
  const unit = tracks[0].units.find((u) => u.unit === lesson.unit)

  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
      <div className="min-w-0 flex-1">
        <h2 className="text-h3">{lesson.title}</h2>
        <p className="mt-0.5 truncate text-small text-muted">
          Unit {lesson.unit} · {unit?.title}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar
            value={passed / inUnit.length}
            label={`Unit ${lesson.unit} progress`}
            className="max-w-[260px]"
          />
          <span className="text-caption text-faint tabular-nums">
            {passed}/{inUnit.length}
          </span>
        </div>
      </div>
      <Link to="/session?kind=lesson" className={primary ? 'ga-btn ga-btn--primary' : 'ga-btn ga-btn--secondary'}>
        {loadResume(lesson.id) ? 'Continue' : passed === 0 && lesson.unit === 1 ? 'Start' : 'Next lesson'}{' '}
        <ArrowRight size={16} aria-hidden />
      </Link>
    </Card>
  )
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function StreakWeek({ p }: { p: ProgressSnapshot }) {
  const today = dayKey()
  const monday = weekStart(today)
  const frozen = new Set(p.streak.frozenDays)
  const { current } = p.streak
  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8 sm:p-6">
      <div className="flex-none sm:w-40">
        <h2 className="text-h3 tabular-nums">{current > 0 ? `${current}-day streak` : 'No streak yet'}</h2>
        <p className="mt-0.5 flex items-center gap-1.5 text-small text-muted">
          <Snowflake size={14} className="text-sky" aria-hidden /> {p.streak.freezesLeft} freeze
          {p.streak.freezesLeft === 1 ? '' : 's'} left
        </p>
      </div>
      <ol className="flex flex-1 justify-between sm:max-w-[420px] sm:ml-auto" aria-label="This week">
        {WEEKDAYS.map((d, i) => {
          const key = addDays(monday, i)
          const done = p.doneDays.has(key)
          return (
            <li
              key={key}
              className="ga-day"
              data-done={done || undefined}
              data-frozen={frozen.has(key) || undefined}
              data-today={key === today || undefined}
              aria-label={`${key}${done ? ', done' : frozen.has(key) ? ', freeze used' : ''}`}
            >
              <span>
                {done ? <Check size={15} strokeWidth={3} /> : frozen.has(key) ? <Snowflake size={14} /> : null}
              </span>
              <span>{d}</span>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
