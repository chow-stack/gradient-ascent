import { dayKey } from '../../lib/dates'
import { db, type FeedbackRow, type FlagReason, type GradientDB, type LessonRating } from '../../lib/db'
import { cardLabel, cardVariants, type Card, type Lesson } from '../content/schema'
import type { Answer } from '../exercises/grading'
import type { Phase } from '../exercises/types'

/**
 * The learner's notes on the content: flags on single cards, and how each lesson felt.
 * Settings turns the open ones into text to paste to Claude, then marks them done.
 */

export const FLAG_REASONS: { id: FlagReason; label: string }[] = [
  { id: 'confusing', label: 'Confusing' },
  { id: 'wrong', label: 'Answer seems wrong' },
  { id: 'easy', label: 'Too easy' },
  { id: 'hard', label: 'Too hard' },
  { id: 'boring', label: 'Boring' },
]

export const RATINGS: { id: LessonRating; label: string }[] = [
  { id: 'easy', label: 'Too easy' },
  { id: 'right', label: 'About right' },
  { id: 'hard', label: 'Too hard' },
]

const reasonLabel = (r: FlagReason) => FLAG_REASONS.find((x) => x.id === r)?.label ?? r
const ratingLabel = (r: LessonRating) => RATINGS.find((x) => x.id === r)?.label ?? r

/** The learner's answer as text, or undefined if there's nothing to show yet. */
export function describeAnswer(answer: Answer): string | undefined {
  switch (answer.type) {
    case 'learn':
      return undefined
    case 'choice':
      return answer.choice ?? undefined
    case 'parsons':
      return answer.lines.length ? answer.lines.join('\n') : undefined
    case 'blank':
      return answer.values.some((v) => v.trim()) ? answer.values.map((v) => v || '(empty)').join(' | ') : undefined
    case 'code':
      return answer.code.trim() ? answer.code : undefined
    case 'explain':
      return answer.text.trim() || undefined
  }
}

/** How the card had gone when it was flagged. */
export function outcomeLabel(phase: Phase, isLearn: boolean): string | undefined {
  if (isLearn) return undefined
  return {
    answering: 'not checked yet',
    checking: 'being checked',
    correct: 'right',
    wrong: 'wrong',
    revealed: 'answer shown',
  }[phase]
}

/** Which version of its card is showing (0 is the card itself), or undefined for cards without variants. */
export function cardVersion(lesson: Lesson, card: Card): number | undefined {
  const base = lesson.cards.find((c) => c.id === card.id)
  if (!base) return undefined
  const variants = cardVariants(base)
  if (!variants.length) return undefined
  const shown = JSON.stringify(card)
  const i = [base, ...variants].findIndex((c) => JSON.stringify(c) === shown)
  return i < 0 ? undefined : i
}

/** The fields a card flag copies from what's on screen. */
export function cardSnapshot(lesson: Lesson, card: Card): Omit<FeedbackRow, 'kind' | 'at' | 'source'> {
  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    unit: lesson.unit,
    cardId: card.id,
    cardType: card.type,
    version: cardVersion(lesson, card),
    prompt: cardLabel(card),
  }
}

/** Adds a row, or updates it when `id` is given. Returns its id. */
export async function saveFeedback(
  row: Omit<FeedbackRow, 'id'>,
  id?: number,
  database: GradientDB = db,
): Promise<number> {
  if (id !== undefined) {
    await database.feedback.put({ ...row, id })
    return id
  }
  return (await database.feedback.add(row)) as number
}

/** Feedback not yet handed over, oldest first. */
export async function openFeedback(database: GradientDB = db): Promise<FeedbackRow[]> {
  const rows = await database.feedback.toArray()
  return rows.filter((r) => !r.done).sort((a, b) => a.at - b.at)
}

export async function markFeedbackDone(database: GradientDB = db): Promise<void> {
  const open = await openFeedback(database)
  await database.feedback.bulkPut(open.map((r) => ({ ...r, done: true })))
}

const SOURCE_LABEL: Record<string, string> = {
  lesson: 'first pass',
  retry: 'retry',
  review: 'review',
  practice: 'practice',
  checkpoint: 'checkpoint',
  project: 'project',
  fresh: 'AI coding task',
}

const shortDate = (at: number) => new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/** A fenced block for multi-line text, inline otherwise. */
function block(label: string, text: string): string {
  if (!text.includes('\n')) return `  ${label}: ${text}`
  const body = text.replace(/\n+$/, '').replace(/^/gm, '    ')
  return `  ${label}:\n    \`\`\`\n${body}\n    \`\`\``
}

/** Tidy text for Claude: grouped by unit, then lesson, oldest first within each. */
export function formatFeedback(all: FeedbackRow[], now = new Date()): string {
  if (!all.length) return ''
  const rows = [...all].sort((a, b) => a.at - b.at)
  const day = dayKey(now)
  const general = rows.filter((r) => r.kind === 'general')
  const out = [
    `# Gradient Ascent feedback, ${day}`,
    '',
    `${rows.length} note${rows.length === 1 ? '' : 's'} from learning. Each card note names the lesson id, the card id and what I saw.`,
  ]
  if (general.length) {
    out.push('', '## General')
    // Prose, so continuation lines are indented under the bullet rather than fenced like code.
    for (const r of general) out.push('', `- ${(r.note ?? '').trim().replace(/\n/g, '\n  ')} (${shortDate(r.at)})`)
  }
  const lessonRows = rows.filter((r) => r.kind !== 'general')
  const units = [...new Set(lessonRows.map((r) => r.unit ?? 0))].sort((a, b) => a - b)
  for (const unit of units) {
    out.push('', `## Unit ${unit}`)
    const inUnit = lessonRows.filter((r) => (r.unit ?? 0) === unit)
    const lessonIds = [...new Set(inUnit.map((r) => r.lessonId))]
    for (const lessonId of lessonIds) {
      const ofLesson = inUnit.filter((r) => r.lessonId === lessonId)
      out.push('', `### ${ofLesson[0].lessonTitle} (${lessonId})`)
      for (const r of ofLesson) {
        out.push('')
        if (r.kind === 'lesson') {
          out.push(`- Lesson felt: ${r.rating ? ratingLabel(r.rating) : 'no rating'} (${shortDate(r.at)})`)
        } else {
          const where = [
            r.cardType,
            r.version !== undefined ? (r.version === 0 ? 'original version' : `variant ${r.version}`) : undefined,
            r.source ? SOURCE_LABEL[r.source] : undefined,
            shortDate(r.at),
          ]
            .filter(Boolean)
            .join(', ')
          out.push(`- Card \`${r.cardId}\` (${where}): ${r.reason ? reasonLabel(r.reason) : 'flagged'}`)
          if (r.prompt) out.push(block('Prompt', r.prompt))
          if (r.answer) out.push(block(r.outcome ? `My answer (${r.outcome})` : 'My answer', r.answer))
          else if (r.outcome) out.push(`  Status: ${r.outcome}`)
        }
        if (r.note?.trim()) out.push(block('Note', r.note.trim()))
      }
    }
  }
  return out.join('\n') + '\n'
}

/** A note about the app or the course as a whole. */
export async function addGeneralNote(note: string, database: GradientDB = db): Promise<number> {
  return saveFeedback({ kind: 'general', at: Date.now(), note: note.trim() }, undefined, database)
}

export async function removeFeedback(id: number, database: GradientDB = db): Promise<void> {
  await database.feedback.delete(id)
}
