import { Bug, Check, ClipboardCopy, Download, ExternalLink, RotateCcw, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Card } from '../components/ui/Card'
import { formatFeedback, markFeedbackDone, openFeedback } from '../features/feedback/feedback'
import { GEMINI_MODEL, getGeminiKey, setGeminiKey, testGeminiKey } from '../features/ai/gemini'
import { dayKey } from '../lib/dates'
import { exportBackup, importBackup, resetProgress, type FeedbackRow } from '../lib/db'
import { setDebug, useDebug } from '../lib/debug'

/** Backup and reset. All progress lives in this browser only, so backups matter. */
export function SettingsPage() {
  const file = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

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

      <Card className="flex flex-col gap-4">
        <h2 className="text-h3">Start over</h2>
        <p className="text-small text-muted">Deletes all attempts, reviews, streak and XP. This can’t be undone.</p>
        <div className="flex flex-wrap gap-3">
          {confirmReset ? (
            <>
              <button
                type="button"
                className="ga-btn ga-btn--danger"
                onClick={() => {
                  void resetProgress().then(() => setMessage({ ok: true, text: 'Progress reset.' }))
                  setConfirmReset(false)
                }}
              >
                Yes, delete everything
              </button>
              <button type="button" className="ga-btn ga-btn--ghost" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="ga-btn ga-btn--secondary" onClick={() => setConfirmReset(true)}>
              <RotateCcw size={16} aria-hidden /> Reset progress
            </button>
          )}
        </div>
      </Card>
    </div>
  )
}

/** The learner's flags and lesson ratings, as text to paste to Claude, then cleared. */
function FeedbackCard() {
  const [rows, setRows] = useState<FeedbackRow[] | null>(null)
  const [copied, setCopied] = useState(false)
  const [cleared, setCleared] = useState(false)
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
  const flags = rows?.filter((r) => r.kind === 'card').length ?? 0
  const ratings = (rows?.length ?? 0) - flags

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-h3">Feedback</h2>
        <p className="max-w-[68ch] text-small text-muted">
          {rows === null
            ? '\u00a0'
            : rows.length
              ? [
                  flags && `${flags} flagged card${flags === 1 ? '' : 's'}`,
                  ratings && `${ratings} lesson rating${ratings === 1 ? '' : 's'}`,
                ]
                  .filter(Boolean)
                  .join(' and ') + ' waiting. Copy them, paste them to Claude, then mark them done.'
              : cleared
                ? 'All handed over. New flags and ratings will collect here.'
                : 'Nothing yet. Flag a card from the top bar of any session, or rate a lesson when you finish it.'}
        </p>
      </div>
      {!!rows?.length && (
        <div className="flex flex-wrap gap-3">
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

/** The learner's own Gemini key, so the AI can grade "explain the code" answers. */
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
        <h2 className="text-h3">AI checking</h2>
        <p className="max-w-[68ch] text-small text-muted">
          Grades your “explain the code” answers and shows which key points you hit. It uses Google’s Gemini (
          <code className="font-mono">{GEMINI_MODEL}</code>) with your own free key. Without a key, you grade yourself.
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
