import { ArrowLeft } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router'
import { lessons } from '../features/content/content'
import { LessonNotes } from '../features/session/LessonNotes'

/** Rereads a finished lesson's teaching, without any exercises. */
export function ReadPage() {
  const { lessonId } = useParams()
  const lesson = lessons.find((l) => l.id === lessonId)
  if (!lesson) return <Navigate to="/path" replace />
  const cards = lesson.cards.filter((c) => c.type === 'learn')
  return (
    <div className="flex flex-col gap-8 pt-2">
      <header className="flex flex-col items-start gap-4">
        <Link to="/path" className="ga-btn ga-btn--ghost ga-btn--sm">
          <ArrowLeft size={14} aria-hidden /> Path
        </Link>
        <h1 className="text-h1">{lesson.title}</h1>
      </header>
      <LessonNotes cards={cards} />
    </div>
  )
}
