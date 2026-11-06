import { Download, ExternalLink, RotateCcw, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Card } from '../components/ui/Card'
import { GEMINI_MODEL, getGeminiKey, setGeminiKey, testGeminiKey } from '../features/ai/gemini'
import { dayKey } from '../lib/dates'
import { exportBackup, importBackup, resetProgress } from '../lib/db'

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

      <GeminiCard />

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

/** The learner's own Gemini key, for checking "explain the code" answers. */
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
        <h2 className="text-h3">Gemini</h2>
        <p className="text-small text-muted">
          Checks your “explain the code” answers with <code className="font-mono">{GEMINI_MODEL}</code>.
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
