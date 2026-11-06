import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { LearnView } from '../exercises/LearnView'
import type { Card } from '../content/schema'

type LearnCard = Extract<Card, { type: 'learn' }>

/** The teaching cards of a lesson, one after another. */
export function LessonNotes({ cards }: { cards: LearnCard[] }) {
  return (
    <div className="flex flex-col gap-10">
      {cards.map((card) => (
        <LearnView key={card.id} card={card} />
      ))}
    </div>
  )
}

/** Rereads the lesson over a session, without losing your place in it. */
export function NotesDialog({ title, cards, onClose }: { title: string; cards: LearnCard[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  return (
    <dialog ref={dialog} className="ga-notes" aria-label={`Reread ${title}`} onClose={onClose}>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-bg px-5 py-3 sm:px-8">
        <h2 className="truncate font-semibold">{title}</h2>
        <button type="button" aria-label="Back to the session" className="ga-icon-btn flex-none" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="px-5 py-6 sm:px-8">
        <LessonNotes cards={cards} />
      </div>
    </dialog>
  )
}
