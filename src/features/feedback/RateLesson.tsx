import { Check } from 'lucide-react'
import { useRef, useState } from 'react'
import type { LessonRating } from '../../lib/db'
import { getLesson } from '../content/content'
import { RATINGS, saveFeedback } from './feedback'

/** "How was that?" after a lesson, checkpoint or project. One tap saves; the note is optional; ignoring it is fine. */
export function RateLesson({ lessonId }: { lessonId: string }) {
  const lesson = getLesson(lessonId)
  const [rating, setRating] = useState<LessonRating | null>(null)
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)
  const id = useRef<Promise<number> | undefined>(undefined)
  const at = useRef(0)
  if (!lesson) return null

  const save = (r: LessonRating, text?: string) => {
    if (!at.current) at.current = Date.now()
    const row = {
      kind: 'lesson' as const,
      lessonId,
      lessonTitle: lesson.title,
      unit: lesson.unit,
      at: at.current,
      rating: r,
      note: text || undefined,
    }
    // Every save after the first updates the same row.
    const prev = id.current
    id.current = (prev ?? Promise.resolve(undefined)).then((existing) => saveFeedback(row, existing))
    id.current.catch(console.error)
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className="text-small font-semibold text-muted" id="rate-label">
        How was that?
      </p>
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-labelledby="rate-label">
        {RATINGS.map((r) => (
          <button
            key={r.id}
            type="button"
            className="ga-pick"
            aria-pressed={rating === r.id}
            onClick={() => {
              setRating(r.id)
              save(r.id, sent ? note.trim() : undefined)
            }}
          >
            {r.label}
          </button>
        ))}
      </div>
      {rating && !sent && (
        <form
          className="ga-feedback-in flex w-full gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!note.trim()) return
            save(rating, note.trim())
            setSent(true)
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Anything that didn’t click?</span>
            <input
              className="ga-input"
              style={{ height: 40, fontSize: 15 }}
              placeholder="Anything that didn’t click? (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button type="submit" className="ga-btn ga-btn--secondary ga-btn--sm flex-none" disabled={!note.trim()}>
            Send
          </button>
        </form>
      )}
      {rating && (
        <p role="status" className="flex items-center gap-1.5 text-caption text-faint">
          <Check size={14} className="text-success" aria-hidden /> {sent ? 'Thanks, noted.' : 'Saved.'}
        </p>
      )}
    </div>
  )
}
