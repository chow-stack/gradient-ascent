import { Bug, Play } from 'lucide-react'
import { Link, Navigate } from 'react-router'
import { lessonsForTrack, tracks } from '../features/content/content'
import { cardLabel, cardVariants } from '../features/content/schema'
import { debugSessionUrl, useDebug } from '../lib/debug'

/** Debug mode: every unit, lesson and card, all open. Nothing done from here is saved. */
export function DebugPage() {
  const debug = useDebug()
  if (!debug) return <Navigate to="/settings" replace />

  return (
    <div className="flex flex-col gap-8 pt-2">
      <header>
        <h1 className="text-h1 flex items-center gap-3">
          <Bug size={28} className="text-accent" aria-hidden /> Debug
        </h1>
        <p className="mt-2 max-w-[62ch] text-muted">
          Open any lesson at any card. In a debug session you can jump between cards and versions without answering, and
          nothing is saved: no XP, reviews, drafts or progress. Turn it off in Settings.
        </p>
      </header>

      {tracks.map((track) =>
        track.units.map((unit) => {
          const unitLessons = lessonsForTrack(track.id).filter((l) => l.unit === unit.unit)
          if (!unitLessons.length) return null
          return (
            <section key={`${track.id}-${unit.unit}`} className="flex flex-col gap-3">
              <h2 className="text-h3">
                Unit {unit.unit} · {unit.title}
              </h2>
              <ul className="flex flex-col gap-2">
                {unitLessons.map((lesson) => (
                  <li key={lesson.id}>
                    <details className="ga-debug-lesson">
                      <summary>
                        <span className="min-w-0 flex-1">
                          <span className="font-semibold">{lesson.title}</span>
                          <span className="ml-2 text-caption text-faint">
                            {lesson.id} · {lesson.kind} · {lesson.cards.length} cards
                          </span>
                        </span>
                        <Link
                          to={debugSessionUrl(lesson.id)}
                          className="ga-btn ga-btn--secondary ga-btn--sm flex-none"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Play size={14} aria-hidden /> Open
                        </Link>
                      </summary>
                      <ol className="mt-2 flex flex-col">
                        {lesson.cards.map((card, i) => (
                          <li key={card.id}>
                            <Link to={debugSessionUrl(lesson.id, card.id)} className="ga-debug-card">
                              <span className="w-6 flex-none text-right text-faint tabular-nums">{i + 1}</span>
                              <span className="ga-tag flex-none">{card.type}</span>
                              <span className="min-w-0 flex-1 truncate">{cardLabel(card)}</span>
                              {cardVariants(card).length > 0 && (
                                <span className="flex-none text-caption text-faint">
                                  +{cardVariants(card).length} versions
                                </span>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ol>
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          )
        }),
      )}
    </div>
  )
}
