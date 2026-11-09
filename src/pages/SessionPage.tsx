import { Mountain } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Adam } from '../components/Adam'
import { needsPython } from '../features/exercises/grading'
import { useWritingTasks } from '../features/fresh/fresh'
import { WritingTasks } from '../features/fresh/WritingTasks'
import { warmUpPython } from '../features/runner/python'
import { buildSession, type SessionKind, type SessionPlan } from '../features/session/plan'
import { SessionRunner } from '../features/session/SessionRunner'
import { isDebug } from '../lib/debug'

const KINDS: SessionKind[] = ['daily', 'review', 'practice', 'lesson', 'debug']

/** /session?kind=daily|review|practice|lesson|debug[&lesson=id][&card=id] — full-screen, no sidebar. */
export function SessionPage() {
  const [params] = useSearchParams()
  const location = useLocation()
  const raw = params.get('kind') as SessionKind | null
  const asked: SessionKind = raw && KINDS.includes(raw) ? raw : 'daily'
  // Debug sessions only open while debug mode is on.
  const kind: SessionKind = asked === 'debug' && !isDebug() ? 'daily' : asked
  const lessonId = params.get('lesson') ?? undefined
  const cardId = params.get('card') ?? undefined
  const [plan, setPlan] = useState<{ key: string; plan: SessionPlan } | null>(null)
  const writingTasks = useWritingTasks()
  // location.key changes on every navigation, so "Practice again" restarts even with the same URL.
  const key = `${kind}:${lessonId ?? ''}:${cardId ?? ''}:${location.key}`

  useEffect(() => {
    const ctl = new AbortController()
    void buildSession(kind, { lessonId, cardId }).then((p) => {
      if (ctl.signal.aborted) return
      if (p.items.some((i) => needsPython(i.card))) void warmUpPython().catch(console.error)
      setPlan({ key, plan: p })
    })
    return () => ctl.abort()
  }, [kind, lessonId, cardId, key])

  if (!plan || plan.key !== key) {
    if (kind === 'daily' && writingTasks)
      return (
        <div className="grid min-h-dvh place-items-center py-10">
          <WritingTasks state={writingTasks} />
        </div>
      )
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-4">
          <Adam mood="think" size={96} title="Loading your session" />
        </div>
      </div>
    )
  }

  if (plan.plan.items.length === 0) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="flex max-w-[440px] flex-col items-center gap-5 text-center">
          <Adam mood="idle" size={120} />
          <div>
            <h1 className="text-h1">Nothing to do here yet</h1>
            <p className="mt-2 text-muted">
              {kind === 'daily'
                ? 'Your Daily 5 is done, or there’s nothing to review yet.'
                : kind === 'review'
                  ? 'Reviews appear after you finish a lesson.'
                  : kind === 'practice'
                    ? 'Finish a lesson first, then practice it here.'
                    : kind === 'debug'
                      ? 'There’s no lesson with that id.'
                      : 'You’ve finished every lesson that exists so far. More are on the way.'}
            </p>
          </div>
          <Link to="/" className="ga-btn ga-btn--primary">
            <Mountain size={16} aria-hidden /> Back to Today
          </Link>
        </div>
      </div>
    )
  }

  return <SessionRunner key={key} plan={plan.plan} />
}
