import { Fragment, type ReactNode } from 'react'

/** Lesson text with `inline code` (backticks) rendered as <code>. */
export function inline(text: string): ReactNode {
  return text
    .split(/(`[^`]+`)/g)
    .map((part, i) =>
      part.startsWith('`') && part.endsWith('`') ? (
        <code key={i}>{part.slice(1, -1)}</code>
      ) : (
        <Fragment key={i}>{part.replace(/\n/g, ' ')}</Fragment>
      ),
    )
}
