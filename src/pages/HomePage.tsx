import { ArrowRight, Check, Dumbbell, Layers, Lock, Play, Snowflake, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Adam } from '../components/Adam'
import { Card } from '../components/ui/Card'
import { ProgressBar } from '../components/ui/ProgressBar'
import { lessons, lessonsForTrack } from '../features/content/content'
import { useProgress, type ProgressSnapshot } from '../features/progress/progress'
import { nextLesson } from '../features/session/plan'
import { addDays, dayKey, weekStart } from '../lib/dates'

const otherTracks = [
  {
    name: 'Web stack',
    detail: 'JavaScript, TypeScript, async, HTTP, React, SQL',
    color: 'var(--color-track-web)',
    phase: 3,
  },
  {
    name: 'ML / AI',
    detail: 'Gradients, micrograd, neural nets, a tiny GPT',
    color: 'var(--color-track-ml)',
    phase: 4,
  },
]

/** Today: what's in today's session, the streak week, and track progress. */
export function HomePage() {
  const p = useProgress()
  if (!p) return <div className="min-h-[60vh]" aria-busy="true" />

  const coreDone = !!p.today?.coreDone
  const upNext = nextLesson(p.mastery)
  const foundations = lessonsForTrack('foundations')
  const passed = foundations.filter((l) => p.mastery.has(l.id)).length
  const reviewsToday = Math.min(p.dueCount, 5)
  const minutes = reviewsToday + (upNext ? 12 : 0)

  return (
    <div className="flex flex-col gap-6 pt-2">
      <section className="ga-card flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:p-8">
        <Adam
          size={112}
          mood={coreDone ? 'happy' : 'idle'}
          title="Adam the mountain goat"
          className="flex-none self-center"
        />
        <div className="min-w-0 flex-1">
          {coreDone ? (
            <>
              <h1 className="text-h1">Done for today</h1>
              <p className="mt-2 max-w-[56ch] text-muted">
                Streak safe. Anything more is a bonus: keep going while you’re in the mood, or come back tomorrow.
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:max-w-[440px]">
                {upNext && (
                  <KeepGoing to="/session?kind=lesson" icon={<ArrowRight size={18} />}>
                    Next lesson: {upNext.title}
                  </KeepGoing>
                )}
                {p.reviewCount > 0 && (
                  <KeepGoing to="/session?kind=review" icon={<Layers size={18} />}>
                    Extra reviews
                  </KeepGoing>
                )}
                {passed > 0 && (
                  <KeepGoing to="/session?kind=practice" icon={<Dumbbell size={18} />}>
                    Practice the last lesson
                  </KeepGoing>
                )}
              </div>
            </>
          ) : upNext || reviewsToday > 0 ? (
            <>
              <h1 className="text-h1">{passed === 0 && p.reviewCount === 0 ? 'Your first climb' : 'Today’s climb'}</h1>
              <ul className="mt-4 flex flex-col gap-2.5">
                {reviewsToday > 0 && (
                  <PlanRow icon={<Layers size={16} />}>
                    Warm-up: {reviewsToday} review{reviewsToday === 1 ? '' : 's'}
                  </PlanRow>
                )}
                {upNext && (
                  <PlanRow icon={<Sparkles size={16} />}>
                    New: <span className="font-semibold text-text">{upNext.title}</span>
                    <span className="text-faint"> · {upNext.summary}</span>
                  </PlanRow>
                )}
              </ul>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <Link to="/session?kind=core" className="ga-btn ga-btn--primary">
                  <Play size={16} aria-hidden /> Start today’s session
                </Link>
                <span className="text-small text-faint">About {minutes} min</span>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-h1">All caught up</h1>
              <p className="mt-2 max-w-[56ch] text-muted">
                You’ve finished every lesson that exists so far and no reviews are due. More content is on the way.
              </p>
            </>
          )}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <StreakWeek p={p} />
        <Card className="flex flex-col justify-center gap-4">
          <Stat label="XP today" value={p.today?.xp ?? 0} />
          <Stat label="Total XP" value={p.totalXp} />
          <Stat label="Lessons passed" value={`${passed} / ${lessons.length}`} />
        </Card>
      </div>

      <section aria-labelledby="tracks-heading" className="flex flex-col gap-3">
        <h2 id="tracks-heading" className="text-h3">
          Tracks
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Link to="/path" className="ga-card flex flex-col gap-3 p-5 transition-colors hover:border-border-strong">
            <div className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-full bg-track-foundations" />
              <h3 className="text-h3">Foundations</h3>
            </div>
            <p className="text-small text-muted">Unit 1 · Python refresher, mapped from Java</p>
            <div className="mt-auto flex items-center gap-3 pt-1">
              <ProgressBar value={passed / foundations.length} label="Foundations progress" />
              <span className="text-caption text-faint tabular-nums">
                {passed}/{foundations.length}
              </span>
            </div>
          </Link>
          {otherTracks.map((t) => (
            <Card key={t.name} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: t.color }} />
                <h3 className="text-h3">{t.name}</h3>
              </div>
              <p className="text-small text-muted">{t.detail}</p>
              <p className="mt-auto flex items-center gap-1.5 pt-1 text-caption text-faint">
                <Lock size={13} aria-hidden /> Arrives in phase {t.phase}
              </p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}

function PlanRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-muted">
      <span className="grid size-7 flex-none place-items-center rounded-full bg-raised text-sky" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  )
}

function KeepGoing({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link to={to} className="ga-choice">
      <span className="ga-choice-key text-sky">{icon}</span>
      <span>{children}</span>
    </Link>
  )
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-small text-muted">{label}</span>
      <span className="text-h3 font-semibold tabular-nums">{value}</span>
    </div>
  )
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function StreakWeek({ p }: { p: ProgressSnapshot }) {
  const today = dayKey()
  const monday = weekStart(today)
  const frozen = new Set(p.streak.frozenDays)
  const { current } = p.streak
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-h3">{current > 0 ? `${current}-day streak` : 'Start a streak'}</h2>
        <span className="flex items-center gap-1.5 text-caption text-sky">
          <Snowflake size={14} aria-hidden /> {p.streak.freezesLeft} freeze{p.streak.freezesLeft === 1 ? '' : 's'} left
        </span>
      </div>
      <ol className="flex justify-between" aria-label="This week">
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
      <p className="text-caption text-faint">
        Finishing the core session counts the day. Up to 2 missed days a week are covered automatically.
      </p>
    </Card>
  )
}
