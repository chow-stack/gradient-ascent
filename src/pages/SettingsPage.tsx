import { Bug, Check, ClipboardCopy, X, Download, ExternalLink, RotateCcw, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Card } from '../components/ui/Card'
import {
  addGeneralNote,
  formatFeedback,
  markFeedbackDone,
  openFeedback,
  removeFeedback,
} from '../features/feedback/feedback'
import { GEMINI_MODEL, getGeminiKey, setGeminiKey, testGeminiKey } from '../features/ai/gemini'
import { dayKey } from '../lib/dates'
import { exportBackup, importBackup, resetProgress, type FeedbackRow } from '../lib/db'
import { setDebug, useDebug } from '../lib/debug'
import { prepareFreshTasks } from '../features/fresh/fresh'
import { resetMastery, resetTodaysDaily } from '../features/progress/progress'

/** Backup and reset. All progress lives in this browser only, so backups matter. */
export function SettingsPage() {
  const file = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const download = async () => {
    const backup = await exportBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `gradient-ascent-backup-${dayKey()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setMessage({ ok: true, text: 'Backup downloaded.' })
  }

  const restore = async (f: File) => {
    try {
      await importBackup(JSON.parse(await f.text()))
      setMessage({ ok: true, text: `Restored progress from ${f.name}.` })
    } catch (e) {
      setMessage({ ok: false, text: e instanceof SyntaxError ? 'That file isn’t valid JSON.' : (e as Error).message })
    }
  }

  return (
    <div className="flex flex-col gap-6 pt-2">
      <header>
        <h1 className="text-h1">Settings</h1>
        <p className="mt-2 max-w-[60ch] text-muted">
          Your progress is stored only in this browser (IndexedDB). Clearing site data erases it, so download a backup
          now and then.
        </p>
      </header>

      <FeedbackCard />
      <GeminiCard />
      <DebugCard />

      <Card className="flex flex-col gap-4">
        <h2 className="text-h3">Backup</h2>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="ga-btn ga-btn--primary" onClick={() => void download()}>
            <Download size={16} aria-hidden /> Download backup
          </button>
          <button type="button" className="ga-btn ga-btn--secondary" onClick={() => file.current?.click()}>
            <Upload size={16} aria-hidden /> Restore from file
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void restore(f)
              e.target.value = ''
            }}
          />
        </div>
        <p className="text-caption text-faint">Restoring replaces everything currently saved here.</p>
        {message && (
          <p role="status" className={message.ok ? 'text-small text-success' : 'text-small text-danger'}>
            {message.text}
          </p>
        )}
      </Card>

      <Card className="flex flex-col gap-1">
        <h2 className="text-h3">Reset</h2>
        <div className="flex flex-col divide-y divide-border">
          <ResetRow
            title="Today’s Daily 5"
            detail="Replaces today’s set with 3 cards from random passed lessons and 2 new coding tasks. XP and streak stay."
            button="Reset Daily 5"
            confirm="Reset today’s set"
            run={async () => {
              await resetTodaysDaily()
              // Start writing the new coding tasks now, so they're ready when the set is opened.
              void prepareFreshTasks()
              return 'Today’s Daily 5 is reset: 3 random cards and 2 new coding tasks.'
            }}
          />
          <ResetRow
            title="Mastered lessons"
            detail="Mastered lessons go back to passed, and are mastered again by getting a review right."
            button="Reset mastery"
            confirm="Reset mastery"
            run={async () => {
              const n = await resetMastery()
              return n ? `${n} lesson${n === 1 ? '' : 's'} back to passed.` : 'No lessons were mastered yet.'
            }}
          />
          <ResetRow
            title="All progress"
            detail="Deletes all attempts, reviews, streak and XP. This can’t be undone."
            button="Reset progress"
            confirm="Yes, delete everything"
            run={async () => {
              await resetProgress()
              return 'Progress reset.'
            }}
          />
        </div>
      </Card>
    </div>
  )
}

/** One reset: a button that asks once more, then says what it did. */
function ResetRow({
  title,
  detail,
  button,
  confirm,
  run,
}: {
  title: string
  detail: string
  button: string
  confirm: string
  run: () => Promise<string>
}) {
  const [asking, setAsking] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-3 py-4 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-0.5 text-small text-muted">{detail}</p>
        {done && (
          <p role="status" className="mt-1.5 text-small text-success">
            {done}
          </p>
        )}
      </div>
      <div className="flex flex-none flex-wrap gap-2">
        {asking ? (
          <>
            <button
              type="button"
              className="ga-btn ga-btn--danger ga-btn--sm"
              onClick={() => {
                setAsking(false)
                void run()
                  .then(setDone)
                  .catch((e) => {
                    console.error(e)
                    setDone(null)
                  })
              }}
            >
              {confirm}
            </button>
            <button type="button" className="ga-btn ga-btn--ghost ga-btn--sm" onClick={() => setAsking(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className="ga-btn ga-btn--secondary ga-btn--sm"
            onClick={() => {
              setDone(null)
              setAsking(true)
            }}
          >
            <RotateCcw size={14} aria-hidden /> {button}
          </button>
        )}
      </div>
    </div>
  )
}

/** The learner's flags and lesson ratings, as text to paste to Claude, then cleared. */
function FeedbackCard() {
  const [rows, setRows] = useState<FeedbackRow[] | null>(null)
  const [copied, setCopied] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [draft, setDraft] = useState('')
  const load = useCallback(() => void openFeedback().then(setRows).catch(console.error), [])
  useEffect(load, [load])
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  const copy = async () => {
    if (!rows?.length) return
    const text = formatFeedback(rows)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // No clipboard permission (or an older browser): copy through a hidden field instead.
      const field = document.createElement('textarea')
      field.value = text
      document.body.append(field)
      field.select()
      document.execCommand('copy')
      field.remove()
    }
    setCopied(true)
  }
  const done = async () => {
    await markFeedbackDone()
    setCleared(true)
    load()
  }
  const addNote = async () => {
    if (!draft.trim()) return
    await addGeneralNote(draft)
    setDraft('')
    load()
  }
  const count = (kind: FeedbackRow['kind']) => rows?.filter((r) => r.kind === kind).length ?? 0
  const flags = count('card')
  const ratings = count('lesson')
  const general = rows?.filter((r) => r.kind === 'general') ?? []
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-h3">Feedback</h2>
        <p className="max-w-[68ch] text-small text-muted">
          {rows === null
            ? '\u00a0'
            : rows.length
              ? [
                  flags && plural(flags, 'flagged card'),
                  ratings && plural(ratings, 'lesson rating'),
                  general.length && plural(general.length, 'general note'),
                ]
                  .filter(Boolean)
                  .join(', ')
                  .replace(/, ([^,]*)$/, ' and $1') + ' waiting. Copy them, paste them to Claude, then mark them done.'
              : cleared
                ? 'All handed over. New flags, ratings and notes will collect here.'
                : 'Nothing yet. Flag a card from the top bar of any session, rate a lesson when you finish it, or write a general note below.'}
        </p>
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void addNote()
        }}
      >
        <label htmlFor="general-note" className="text-small font-semibold">
          General feedback
        </label>
        <textarea
          id="general-note"
          className="ga-textarea"
          style={{ minHeight: 76 }}
          rows={2}
          placeholder="Anything about the app or the course as a whole"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void addNote()
            }
          }}
        />
        <div>
          <button type="submit" className="ga-btn ga-btn--secondary ga-btn--sm" disabled={!draft.trim()}>
            Add note
          </button>
        </div>
      </form>
      {general.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="General notes waiting">
          {general.map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-2 rounded-[var(--radius-md)] bg-raised py-2 pr-1.5 pl-3 text-small"
            >
              <span className="min-w-0 flex-1 py-1 whitespace-pre-wrap">{r.note}</span>
              <button
                type="button"
                className="ga-icon-btn size-8 flex-none"
                aria-label="Delete this note"
                onClick={() => void removeFeedback(r.id!).then(load)}
              >
                <X size={15} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!!rows?.length && (
        <div className="flex flex-wrap gap-3 border-t border-border pt-4">
          <button type="button" className="ga-btn ga-btn--primary" onClick={() => void copy()}>
            {copied ? <Check size={16} aria-hidden /> : <ClipboardCopy size={16} aria-hidden />}
            {copied ? 'Copied' : 'Copy feedback for Claude'}
          </button>
          <button type="button" className="ga-btn ga-btn--ghost" onClick={() => void done()}>
            Mark done
          </button>
        </div>
      )}
    </Card>
  )
}

/** Debug mode: open any lesson at any card, without saving anything. */
function DebugCard() {
  const debug = useDebug()
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-h3">Debug mode</h2>
        <p className="max-w-[68ch] text-small text-muted">
          Open any unit or lesson, start at any card, and jump between cards and their versions without answering. Debug
          sessions save nothing: no XP, reviews, drafts or progress.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2.5 font-semibold">
          <input
            type="checkbox"
            className="size-4 accent-[var(--color-accent)]"
            checked={debug}
            onChange={(e) => setDebug(e.target.checked)}
          />
          Debug mode
        </label>
        {debug && (
          <Link to="/debug" className="ga-btn ga-btn--secondary ga-btn--sm">
            <Bug size={14} aria-hidden /> Open the lesson browser
          </Link>
        )}
      </div>
    </Card>
  )
}

/** The learner's own Gemini key, so the AI can grade "explain the code" answers and write the Daily 5's coding tasks. */
function GeminiCard() {
  const [saved, setSaved] = useState(getGeminiKey)
  const [draft, setDraft] = useState('')
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const save = async () => {
    const key = draft.trim()
    setGeminiKey(key)
    setSaved(key)
    setDraft('')
    setTesting(true)
    setMessage(null)
    const problem = await testGeminiKey(key)
    setTesting(false)
    setMessage(problem ? { ok: false, text: problem } : { ok: true, text: 'Key saved and working.' })
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-h3">AI</h2>
        <p className="max-w-[68ch] text-small text-muted">
          Grades your “explain the code” answers, and writes 2 new coding tasks for each Daily 5 from what you’ve
          learned. It uses Google’s Gemini (<code className="font-mono">{GEMINI_MODEL}</code>) with your own free key.
          Without a key, you grade yourself and the Daily 5 is all review.
        </p>
      </div>
      {saved ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-small text-muted">
            Key saved, ending in <span className="font-mono text-text">{saved.slice(-4)}</span>
          </p>
          <button
            type="button"
            className="ga-btn ga-btn--ghost ga-btn--sm"
            onClick={() => {
              setGeminiKey('')
              setSaved('')
              setMessage({ ok: true, text: 'Key removed.' })
            }}
          >
            Remove key
          </button>
        </div>
      ) : (
        <form
          className="flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (draft.trim()) void save()
          }}
        >
          <label className="min-w-[240px] flex-1">
            <span className="sr-only">Gemini API key</span>
            <input
              className="ga-input font-mono"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="Paste your API key"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <button type="submit" className="ga-btn ga-btn--primary" disabled={!draft.trim()}>
            Save key
          </button>
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="ga-btn ga-btn--secondary"
          >
            Get a key <ExternalLink size={16} aria-hidden />
          </a>
        </form>
      )}
      {testing && (
        <p role="status" className="text-small text-muted">
          Testing your key…
        </p>
      )}
      {message && (
        <p role="status" className={message.ok ? 'text-small text-success' : 'text-small text-danger'}>
          {message.text}
        </p>
      )}
      <p className="max-w-[68ch] text-caption text-faint">
        The key stays in this browser and is left out of backups. Your explanations go to Google. On the free tier,
        Google may use them to improve its products, and people may read them.
      </p>
    </Card>
  )
}
