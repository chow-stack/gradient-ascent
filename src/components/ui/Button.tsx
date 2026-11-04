import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: 'sm' | 'md'
  /** Keyboard shortcut hint shown inside the button, e.g. "↵". */
  kbd?: ReactNode
}

/** Summit button: flat fill, 1px top highlight, soft shadow, 1px press. Styles: `.ga-btn` in components.css. */
export function Button({ variant = 'primary', size = 'md', kbd, className, children, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn('ga-btn', `ga-btn--${variant}`, size === 'sm' && 'ga-btn--sm', className)}
      {...props}
    >
      {children}
      {kbd && <span className="ga-kbd">{kbd}</span>}
    </button>
  )
}
