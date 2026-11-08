import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FlagReason } from '../../lib/db'
import { FLAG_REASONS } from './feedback'

export type Flag = { reason: FlagReason; note: string }

/** Flag the card on screen: one tap for the reason, an optional note. */
export function FlagDialog({
  initial,
  onSave,
  onRemove,
  onClose,
}: {
  initial?: Flag
  onSave: (flag: Flag) => void
  /** Offered when the card is already flagged. */
  onRemove?: () => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState<FlagReason | undefined>(initial?.reason)
  const [note, setNote] = useState(initial?.note ?? '')
  useEffect(() => {
    dialog.current?.showModal()
    // showModal focuses the first button (Close); start on the reasons instead.
    dialog.current?.querySelector<HTMLElement>('[data-start]')?.focus()
  }, [])
  const save = () => reason && onSave({ reason, note: note.trim() })

  return (
    <dialog
      ref={dialog}
      className="ga-sheet"
      aria-labelledby="flag-title"
      // Keys pressed here are the dialog's own: the session must not also act on Enter or 1–4.
      data-own-keys
      onClose={onClose}
      // A click on the backdrop lands on the dialog itself.
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="flag-title" className="text-h3">
            What’s off with this card?
          </h2>
          <button type="button" aria-label="Close" className="ga-icon-btn -mr-2 flex-none" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Reason">
          {FLAG_REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              className="ga-pick"
              aria-pressed={reason === r.id}
              // Focus starts on the reason already picked, or the first.
              data-start={(initial ? initial.reason === r.id : r.id === FLAG_REASONS[0].id) || undefined}
              onClick={() => setReason(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-small text-muted">Anything to add? (optional)</span>
          <textarea
            className="ga-textarea"
            style={{ minHeight: 76 }}
            rows={2}
            value={note}
            placeholder="What you expected, or what threw you"
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                save()
              }
            }}
          />
        </label>
        <div className="flex items-center justify-end gap-2">
          {onRemove && (
            <button type="button" className="ga-btn ga-btn--ghost ga-btn--sm mr-auto" onClick={onRemove}>
              Remove flag
            </button>
          )}
          <button type="button" className="ga-btn ga-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="ga-btn ga-btn--primary" disabled={!reason}>
            {initial ? 'Update' : 'Flag it'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
