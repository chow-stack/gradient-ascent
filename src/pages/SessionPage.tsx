import { Mountain } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Adam } from '../components/Adam'
import { needsPython } from '../features/exercises/grading'
import { warmUpPython } from '../features/runner/python'
import { buildSession, type SessionKind, type SessionPlan } from '../features/session/plan'
import { SessionRunner } from '../features/session/SessionRunner'

const KINDS: SessionKind[] = ['daily', 'review', 'practice', 'lesson']

/** /session?kind=daily|review|practice|lesson[&lesson=id] — full-screen, no sidebar. */
export function SessionPage() {
  const [params] = useSearchParams()
  const location = useLocation()
  const raw = params.get('kind') as SessionKind | null
  const kind: SessionKind = raw && KINDS.includes(raw) ? raw : 'daily'
  const lessonId = params.get('lesson') ?? undefined
  const [plan, setPlan] = useState<{ key: string; plan: SessionPlan } | null>(null)
  // location.key changes on every navigation, so "Practice again" restarts even with the same URL.
  const key = `${kind}:${lessonId ?? ''}:${location.key}`

  useEffect(() => {
    const ctl = new AbortController()
    void buildSession(kind, { lessonId }).then((p) => {
      if (ctl.signal.aborted) return
      if (p.items.some((i) => needsPython(i.card))) void warmUpPython().catch(console.error)
      setPlan({ key, plan: p })
    })
    return () => ctl.abort()
  }, [kind, lessonId, key])

  if (!plan || plan.key !== key) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Adam mood="think" size={96} title="Loading your session" />
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
