import { Play } from 'lucide-react'
import type { ReactNode } from 'react'

const KEYWORDS = new Set([
  'def', 'return', 'for', 'in', 'while', 'if', 'elif', 'else', 'import', 'from', 'class', 'True', 'False', 'None',
  'and', 'or', 'not', 'is', 'break', 'continue', 'pass', 'lambda', 'try', 'except', 'finally', 'with', 'as', 'raise',
]) // prettier-ignore

// The blank marker comes first so `____` isn't read as an identifier.
const TOKENS = /(____)|(#.*$)|("[^"]*"|'[^']*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)(?=\s*\()|([A-Za-z_]\w*)/g

type BlankRender = ReactNode | ((index: number) => ReactNode)

/** Tiny display-only highlighter. Editing uses Monaco (CodeEditor). */
function highlight(line: string, blank: BlankRender | undefined, slot: { n: number }) {
  const out: ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of line.matchAll(TOKENS)) {
    const start = m.index ?? 0
    if (start > last) out.push(line.slice(last, start))
    const [text, isSlot, com, str, num, fn, word] = m
    const key = i++
    const slotNode = (k: number | string, marker: string) => {
      const index = slot.n++
      return <span key={k}>{typeof blank === 'function' ? blank(index) : (blank ?? marker)}</span>
    }
    if (isSlot) out.push(slotNode(key, text))
    else if (com) out.push(span(key, 'com', text))
    else if (str) {
      // A blank can sit inside a string, as in f"Level {____}".
      text.split('____').forEach((part, n) => {
        if (n > 0) out.push(slotNode(`${key}-slot-${n}`, '____'))
        if (part) out.push(span(`${key}-${n}`, 'str', part))
      })
    } else if (num) out.push(span(key, 'num', text))
    else if (fn) out.push(span(key, KEYWORDS.has(fn) ? 'kw' : 'fn', text))
    else if (word) out.push(KEYWORDS.has(word) ? span(key, 'kw', text) : text)
    last = start + text.length
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}

const span = (key: number | string, className: string, text: string) => (
  <span key={key} className={className}>
    {text}
  </span>
)

type CodeBlockProps = {
  code: string
  filename?: string
  /** Rendered in place of each `____` in the code (a function gets the slot index). */
  blank?: BlankRender
  /** 1-based line to highlight. */
  highlightLine?: number
  showRun?: boolean
  /** Show line numbers (useful when an exercise refers to "line 3"). */
  numbered?: boolean
  /** Subgoal labels: shown as a row above the given 1-based line. */
  labels?: Record<number, string>
  /** Extra content on the right of the header (replaces the word Python). */
  headerRight?: ReactNode
}

export function CodeBlock({
  code,
  filename,
  blank,
  highlightLine,
  showRun,
  numbered,
  labels,
  headerRight,
}: CodeBlockProps) {
  const lines = code.replace(/\n$/, '').split('\n')
  const slot = { n: 0 }
  return (
    <div className={numbered ? 'ga-code ga-code--numbered' : 'ga-code'}>
      <div className="ga-code-header">
        <span>{filename ?? 'main.py'}</span>
        {headerRight ??
          (showRun ? (
            <span className="inline-flex items-center gap-1.5">
              <Play size={12} aria-hidden /> Run
            </span>
          ) : (
            <span>Python</span>
          ))}
      </div>
      <pre>
        <code>
          {lines.map((line, idx) => (
            <span key={idx} className="contents">
              {labels?.[idx + 1] && (
                <span className="ln-label" data-first={idx === 0 || undefined}>
                  {labels[idx + 1]}
                </span>
              )}
              <span className="ln-row" data-hl={highlightLine === idx + 1 ? 'true' : undefined}>
                <span className="ln" aria-hidden>
                  {idx + 1}
                </span>
                {line.length ? highlight(line, blank, slot) : ' '}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}
