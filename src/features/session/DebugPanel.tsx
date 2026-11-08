import {
  ArrowDownUp,
  ArrowLeft,
  BookOpen,
  Bug,
  ChevronLeft,
  ChevronRight,
  Code,
  Hammer,
  ListChecks,
  MessageSquareText,
  PanelLeftClose,
  TextCursorInput,
  Wrench,
} from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import { cardLabel, cardVariants, type CardType } from '../content/schema'
import type { SessionItem } from './plan'

const TYPE: Record<CardType, { label: string; icon: ReactNode }> = {
  learn: { label: 'Learn', icon: <BookOpen size={15} /> },
  choice: { label: 'Choice', icon: <ListChecks size={15} /> },
  parsons: { label: 'Parsons', icon: <ArrowDownUp size={15} /> },
  blank: { label: 'Blank', icon: <TextCursorInput size={15} /> },
  fix: { label: 'Fix', icon: <Wrench size={15} /> },
  write: { label: 'Write', icon: <Code size={15} /> },
  explain: { label: 'Explain', icon: <MessageSquareText size={15} /> },
  project: { label: 'Project', icon: <Hammer size={15} /> },
}

/**
 * Debug mode's sidebar: the lesson's cards, the current one's versions, and previous/next. Picking anything
 * opens it fresh, without answering. On wide screens it sits beside the card; on narrow ones it slides over it.
 */
export function DebugPanel({
  items,
  idx,
  version,
  onGo,
  onClose,
}: {
  items: SessionItem[]
  idx: number
  version: number
  onGo: (i: number, version?: number) => void
  onClose: () => void
}) {
  const lesson = items[idx].lesson
  const base = lesson.cards[idx]
  const versions = 1 + cardVariants(base).length
  const active = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    active.current?.scrollIntoView({ block: 'nearest' })
  }, [idx])

  return (
    <aside className="ga-debug-panel" aria-label="Debug">
      <div className="flex items-start gap-3 border-b border-border px-4 pt-4 pb-3.5">
        <span className="ga-debug-badge" aria-hidden>
          <Bug size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold tracking-wide text-accent uppercase">Debug · nothing saved</p>
          <p className="line-clamp-2 leading-snug font-semibold">{lesson.title}</p>
          <p className="truncate text-caption text-faint">
            Unit {lesson.unit} · {lesson.kind} · {lesson.id}
          </p>
        </div>
        <button type="button" className="ga-icon-btn -mr-1 size-8!" aria-label="Hide debug panel" onClick={onClose}>
          <PanelLeftClose size={17} />
        </button>
      </div>

      <div className="flex flex-col gap-3 border-b border-border px-4 py-3.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="ga-debug-step"
            disabled={idx === 0}
            onClick={() => onGo(idx - 1)}
            aria-label="Previous card"
            title="Previous card (Alt ←)"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="font-semibold tabular-nums">
              Card {idx + 1} <span className="text-faint">of {items.length}</span>
            </p>
            <p className="truncate font-mono text-caption text-faint" title="Card id">
              {base.id}
            </p>
          </div>
          <button
            type="button"
            className="ga-debug-step"
            disabled={idx >= items.length - 1}
            onClick={() => onGo(idx + 1)}
            aria-label="Next card"
            title="Next card (Alt →)"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {versions > 1 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-caption font-semibold text-muted">Version</p>
            <div className="ga-debug-versions" role="radiogroup" aria-label="Card version">
              {Array.from({ length: versions }, (_, v) => (
                <button key={v} type="button" role="radio" aria-checked={v === version} onClick={() => onGo(idx, v)}>
                  {v === 0 ? 'Original' : v + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <ol className="ga-debug-list min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-label="Cards">
        {items.map((it, i) => {
          const card = lesson.cards[i]
          const extra = cardVariants(card).length
          const current = i === idx
          return (
            <li key={it.itemId}>
              <button
                ref={current ? active : undefined}
                type="button"
                className="ga-debug-row"
                aria-current={current ? 'step' : undefined}
                onClick={() => onGo(i)}
              >
                <span className="w-5 flex-none text-right text-caption text-faint tabular-nums">{i + 1}</span>
                <span className="ga-debug-type" data-type={card.type} title={TYPE[card.type].label}>
                  {TYPE[card.type].icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-small">{cardLabel(card)}</span>
                  <span className="block text-caption text-faint">
                    {TYPE[card.type].label}
                    {extra > 0 && ` · ${extra + 1} versions`}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="border-t border-border p-3">
        <Link to="/debug" className="ga-btn ga-btn--ghost ga-btn--sm w-full justify-center">
          <ArrowLeft size={15} aria-hidden /> All lessons
        </Link>
      </div>
    </aside>
  )
}
