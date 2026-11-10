import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import type { Card } from '../content/schema'
import type { Answer } from '../exercises/grading'
import { ReviewItem } from './DailyReview'

/** One checkpoint question the learner missed, in the version they were asked, with their answer (none if blank). */
export type MissedQuestion = { key: string; card: Card; answer?: Answer }

/** After a checkpoint: only the questions missed, each with the learner's answer, the right one and why. */
export function CheckpointReview({ questions, onBack }: { questions: MissedQuestion[]; onBack: () => void }) {
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[680px] flex-col px-4 pt-4 pb-16 sm:pt-8">
      <button type="button" className="ga-btn ga-btn--ghost ga-btn--sm -ml-2 self-start" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden /> Back to results
      </button>
      <header className="mt-5">
        <h1 className="text-h1">What you missed</h1>
        <p className="mt-1.5 text-muted">
          {questions.length} {questions.length === 1 ? 'question' : 'questions'}, as you saw them. A retake asks
          different ones.
        </p>
      </header>
      <ol className="mt-8 flex flex-col gap-3">
        {questions.map((q, i) => (
          <li key={q.key}>
            <ReviewItem
              n={i + 1}
              result="missed"
              entry={{ card: q.card, answer: q.answer }}
              unanswered="You left this one blank."
            />
          </li>
        ))}
      </ol>
    </div>
  )
}
