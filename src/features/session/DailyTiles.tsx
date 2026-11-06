import { Check, X } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Adam, type AdamMood } from '../../components/Adam'
import { cn } from '../../lib/cn'
import type { DailyResult } from '../../lib/db'
import { describeDaily } from './daily'

type Results = (DailyResult | null)[]

export function DailyTile({
  result,
  current,
  style,
}: {
  result: DailyResult | null
  current?: boolean
  style?: CSSProperties
}) {
  return (
    <span className="ga-tile" data-state={result ?? undefined} data-current={current || undefined} style={style}>
      {result === 'missed' ? (
        <X className="ga-tile-icon" strokeWidth={3} aria-hidden />
      ) : result ? (
        <Check className="ga-tile-icon" strokeWidth={3} aria-hidden />
      ) : null}
    </span>
  )
}

/** Flat row for the session's top bar. A tile flips when its answer lands. */
export function DailyTileRow({ results }: { results: Results }) {
  const current = results.indexOf(null)
  return (
    <div className="ga-tile-row" role="img" aria-label={describeDaily(results)}>
      {results.map((r, i) => (
        <span key={i} className="contents">
          <DailyTile result={r} current={i === current} />
        </span>
      ))}
    </div>
  )
}

/** The five tiles as a staircase with Adam climbing it. `at` is the tile he's standing on. */
export function DailySteps({
  results,
  at,
  mood = 'idle',
  flip,
  wave,
  stepMs = 0,
  resting,
  className,
}: {
  results: Results
  at: number
  mood?: AdamMood
  /** Flip each tile over in turn, as Adam reaches it. */
  flip?: boolean
  /** A small bounce through the tiles after the flips (a clean sweep). */
  wave?: boolean
  stepMs?: number
  /** Nothing to do yet, so no tile is marked as next. */
  resting?: boolean
  className?: string
}) {
  const current = flip || resting ? -1 : results.indexOf(null)
  return (
    <div
      className={cn('ga-steps', className)}
      role="img"
      aria-label={describeDaily(results)}
      style={{ '--at': at } as CSSProperties}
      data-flip={flip || undefined}
      data-wave={wave || undefined}
    >
      {results.map((r, i) => (
        <DailyTile
          key={i}
          result={r}
          current={i === current}
          style={
            {
              '--i': i,
              '--flip-delay': `${i * stepMs}ms`,
              '--wave-delay': `${results.length * stepMs + 260 + i * 70}ms`,
            } as CSSProperties
          }
        />
      ))}
      <span className="ga-steps-adam" aria-hidden>
        <Adam key={mood} mood={mood} size={64} />
      </span>
    </div>
  )
}
