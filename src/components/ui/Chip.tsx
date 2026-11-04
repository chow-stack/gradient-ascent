import type { ReactNode } from 'react'

/** Pill for stats: streak, XP, freezes. */
export function Chip({
  icon,
  children,
  color,
  label,
}: {
  icon: ReactNode
  children: ReactNode
  color: string
  label: string
}) {
  return (
    <span className="ga-chip" style={{ color }} title={label}>
      <span aria-hidden className="flex">
        {icon}
      </span>
      <span className="sr-only">{label}: </span>
      {children}
    </span>
  )
}

/** Small neutral label, e.g. the exercise type. */
export function Tag({ children }: { children: ReactNode }) {
  return <span className="ga-tag">{children}</span>
}
