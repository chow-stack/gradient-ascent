import { CircleAlert } from 'lucide-react'
import type { RunError } from '../../runner/harness'
import { inline } from '../inline'

export function ErrorNote({ what, error }: { what: string; error: RunError }) {
  const text =
    error.type === 'Timeout'
      ? error.message
      : `${what} crashed with ${error.type}: ${error.message}${error.line ? ` (line ${error.line})` : ''}`
  return (
    <p className="ga-play-error" role="alert">
      <CircleAlert size={16} className="mt-0.5 flex-none" aria-hidden />
      <span>{text}</span>
    </p>
  )
}

/** Shown in place of a control the program can't drive yet. */
export function Needs({ names, to }: { names: string[]; to: string }) {
  const code = names.map((n) => `\`${n}\``)
  const list = code.length > 1 ? `${code.slice(0, -1).join(', ')} and ${code[code.length - 1]}` : code[0]
  return <p className="ga-play-empty">{inline(`Write ${list} to ${to}.`)}</p>
}
