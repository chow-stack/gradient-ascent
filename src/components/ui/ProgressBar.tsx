import { cn } from '../../lib/cn'

/** Slim continuous bar (home screen, skill progress). */
export function ProgressBar({ value, label, className }: { value: number; label: string; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div
      className={cn('ga-bar', className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div className="ga-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Segmented bar, one segment per card (lesson header). */
export function SegmentedProgress({
  total,
  done,
  current,
  label,
}: {
  total: number
  done: number
  /** Index of the card being worked on (shown half-filled). */
  current?: number
  label: string
}) {
  return (
    <div
      className="ga-segments"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
    >
      {Array.from({ length: total }, (_, i) => (
        <span key={i} data-done={i < done ? 'true' : undefined} data-current={i === current ? 'true' : undefined} />
      ))}
    </div>
  )
}
