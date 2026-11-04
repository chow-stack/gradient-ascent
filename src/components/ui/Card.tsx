import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

/** Surface panel: one step lighter than the page, 1px hairline border, 18px radius. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ga-card p-5', className)} {...props} />
}
