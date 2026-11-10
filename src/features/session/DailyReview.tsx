import { ArrowLeft, Check, ChevronDown, X } from 'lucide-react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'
import { CodeBlock } from '../../components/CodeBlock'
import { cn } from '../../lib/cn'
import type { DayKey } from '../../lib/dates'
import { db, type DailyResult, type DailyReviewEntry, type DailyRow } from '../../lib/db'
import { fillBlanks, type Card } from '../content/schema'
import type { Answer } from '../exercises/grading'
import { inline } from '../exercises/inline'
import { Prose } from '../exercises/shared'
import { DailyTile, DailyTileRow } from './DailyTiles'

/** Every problem in a day's Daily 5: what was asked, what the learner answered, and the right answer. */
export function DailyReview({
  day,
  onBack,
  backLabel = 'Back',
}: {
  day: DayKey
  onBack: () => void
  backLabel?: string
}) {
  const [row, setRow] = useState<DailyRow | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    void db.dailies.get(day).then((r) => live && setRow(r ?? null))
    return () => {
      live = false
    }
  }, [day])
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])

  const ids = row?.itemIds.filter((id) => row.results[id]) ?? []
  const results = row?.itemIds.map((id) => row.results[id] ?? null) ?? []
  const clean = ids.filter((id) => row?.results[id] === 'clean').length

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto flex min-h-dvh w-full max-w-[680px] flex-col px-4 pt-4 pb-16 sm:pt-8">
        <button type="button" className="ga-btn ga-btn--ghost ga-btn--sm -ml-2 self-start" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden /> {backLabel}
        </button>
        <header className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-h1">Your Daily {row?.itemIds.length || 5}</h1>
            {row && (
              <p className="mt-1.5 text-muted tabular-nums">
                {clean} of {ids.length} right first try
              </p>
            )}
          </div>
          {row && <DailyTileRow results={results} />}
        </header>

        {row === null || (row && ids.length === 0) ? (
          <p className="mt-10 text-muted">Nothing answered yet today.</p>
        ) : (
          <ol className="mt-8 flex flex-col gap-3">
            {row &&
              ids.map((id, i) => (
                <motion.li
                  key={id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <ReviewItem n={i + 1} result={row.results[id]} entry={row.review?.[id]} />
                </motion.li>
              ))}
          </ol>
        )}
      </div>
    </MotionConfig>
  )
}

const RESULT: Record<DailyResult, { label: string; className: string }> = {
  clean: { label: 'First try', className: 'text-success' },
  assisted: { label: 'With help', className: 'text-xp' },
  missed: { label: 'Missed', className: 'text-danger' },
}

function kindLabel(card: Card, task: boolean): string {
  if (task) return 'Coding task'
  switch (card.type) {
    case 'choice':
      return card.kind === 'predict' ? 'What does it print?' : 'Question'
    case 'parsons':
      return 'Put the lines in order'
    case 'blank':
      return 'Fill in the blank'
    case 'fix':
      return 'Fix the bug'
    case 'write':
      return 'Write the code'
    case 'explain':
      return 'Explain'
    default:
      return 'Problem'
  }
}

/** One answered problem, folded to its prompt. Also used for the questions missed in a checkpoint. */
export function ReviewItem({
  n,
  result,
  entry,
  unanswered,
}: {
  n: number
  result: DailyResult
  entry?: DailyReviewEntry
  /** Shown in place of the learner's answer when they gave none. */
  unanswered?: string
}) {
  // Misses start open: they're the ones worth a look.
  const [open, setOpen] = useState(result === 'missed')
  const bodyId = useId()
  const r = RESULT[result]
  const title = entry ? (entry.title ?? ('prompt' in entry.card ? entry.card.prompt : '')) : 'This problem'

  return (
    <div className="ga-review-item" data-open={open || undefined}>
      <button
        type="button"
        className="ga-review-head"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
      >
        <DailyTile result={result} style={{ '--tile': '30px' } as CSSProperties} />
        <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
          <span className="text-caption text-faint">
            {n} · {entry ? kindLabel(entry.card, !!entry.title) : 'Problem'}
          </span>
          <span className="w-full truncate font-semibold">{inline(title.replace(/\s+/g, ' '))}</span>
        </span>
        <span className={cn('hidden flex-none text-small font-semibold sm:inline', r.className)}>{r.label}</span>
        <ChevronDown size={18} className="ga-review-chevron flex-none text-faint" aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bodyId}
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-5 px-4 pt-1 pb-5 sm:px-5">
              <span className={cn('text-small font-semibold sm:hidden', r.className)}>{r.label}</span>
              {entry ? (
                <Body entry={entry} right={result !== 'missed'} unanswered={unanswered} />
              ) : (
                <p className="text-muted">This one was answered before reviews were saved.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** The question, the learner's answer, and the right one. */
function Body({ entry, right, unanswered }: { entry: DailyReviewEntry; right: boolean; unanswered?: string }) {
  const { card, answer } = entry
  const why = 'why' in card ? card.why : undefined
  // The note for the wrong choice picked, naming the mistake behind it.
  const miss =
    card.type === 'choice' && answer?.type === 'choice' && answer.choice ? card.misses[answer.choice] : undefined
  return (
    <>
      {/* The heading already shows a short prompt in full; a task's brief or a long prompt is shown here. */}
      {'prompt' in card && (entry.title || card.prompt.length > 60) && <Prose text={card.prompt} />}
      {'code' in card && card.code && card.type !== 'blank' && card.type !== 'parsons' && card.type !== 'fix' && (
        <CodeBlock code={card.code} highlightLine={'highlightLine' in card ? card.highlightLine : undefined} />
      )}
      {card.type === 'choice' ? (
        <>
          {!answer && unanswered && <p className="text-muted">{unanswered}</p>}
          <Choices card={card} picked={answer?.type === 'choice' ? answer.choice : null} />
        </>
      ) : (
        <Answers card={card} answer={answer} right={right} unanswered={unanswered} />
      )}
      {(miss || why) && (
        <div className="flex flex-col gap-2">
          <Label>Why</Label>
          {miss && <Prose text={miss} />}
          {why && <Prose text={why} className="text-muted" />}
        </div>
      )}
    </>
  )
}

function Choices({ card, picked }: { card: Extract<Card, { type: 'choice' }>; picked: string | null }) {
  return (
    <ul className="flex flex-col gap-2">
      {card.choices.map((c) => {
        const answer = c === card.answer
        const wrong = c === picked && !answer
        return (
          <li key={c} className="ga-review-choice" data-state={answer ? 'right' : wrong ? 'wrong' : undefined}>
            <span className="min-w-0 flex-1 font-mono text-[14px] whitespace-pre-wrap">{c}</span>
            {answer ? (
              <span className="flex flex-none items-center gap-1 text-caption font-semibold text-success">
                <Check size={14} strokeWidth={3} aria-hidden /> {c === picked ? 'Your answer' : 'Answer'}
              </span>
            ) : wrong ? (
              <span className="flex flex-none items-center gap-1 text-caption font-semibold text-danger">
                <X size={14} strokeWidth={3} aria-hidden /> Your answer
              </span>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/** Code and text answers: the learner's last checked one, then the right one. */
function Answers({
  card,
  answer,
  right,
  unanswered,
}: {
  card: Card
  answer?: Answer
  right: boolean
  unanswered?: string
}) {
  const mine = shownAnswer(card, answer)
  const correct = rightAnswer(card)
  if (!correct) return null
  // A right fill-in or ordering is the answer itself, so it's shown once.
  const same = right && (card.type === 'blank' || card.type === 'parsons')
  const code = card.type !== 'explain'
  const solutionLabel =
    card.type === 'explain'
      ? 'A good answer'
      : card.type === 'write' || card.type === 'fix'
        ? right
          ? 'Model solution'
          : 'Solution'
        : 'Answer'

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>
          {mine ? (
            <span className={cn('flex items-center gap-1', right ? 'text-success' : 'text-danger')}>
              {right ? <Check size={14} strokeWidth={3} aria-hidden /> : <X size={14} strokeWidth={3} aria-hidden />}{' '}
              Your answer
            </span>
          ) : (
            'Your answer'
          )}
        </Label>
        {!mine ? (
          <p className="text-muted">{unanswered ?? 'You showed the answer without checking one.'}</p>
        ) : code ? (
          <CodeBlock code={mine} filename="yours.py" />
        ) : (
          <p className="ga-review-quote">{mine}</p>
        )}
      </div>
      {!same && (
        <div>
          <Label>{solutionLabel}</Label>
          {code ? (
            <CodeBlock code={correct} filename="answer.py" />
          ) : (
            <p className="ga-review-quote">{inline(correct)}</p>
          )}
          {card.type === 'explain' && (
            <ul className="mt-3 flex flex-col gap-1 text-small text-muted">
              {card.keyPoints.map((k) => (
                <li key={k} className="flex gap-2">
                  <span className="text-faint">•</span>
                  <span>{inline(k)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function shownAnswer(card: Card, answer?: Answer): string | null {
  if (!answer) return null
  switch (answer.type) {
    case 'blank':
      return card.type === 'blank' ? fillBlanks(card.code, answer.values) : answer.values.join(', ')
    case 'parsons':
      return answer.lines.join('\n')
    case 'code':
      return answer.code
    case 'explain':
      return answer.text
    default:
      return null
  }
}

function rightAnswer(card: Card): string | null {
  switch (card.type) {
    case 'blank':
      return fillBlanks(
        card.code,
        card.answers.map((a) => a[0]),
      )
    case 'parsons':
      return card.code
    case 'fix':
    case 'write':
      return card.solution
    case 'explain':
      return card.model
    default:
      return null
  }
}

const Label = ({ children }: { children: ReactNode }) => (
  <h3 className="mb-2 text-small font-semibold text-muted">{children}</h3>
)
