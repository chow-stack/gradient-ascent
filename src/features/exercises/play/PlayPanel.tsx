import { RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { PlayKind } from '../../content/schema'
import type { RunError } from '../../runner/harness'
import { playCall, playLoad, runPython } from '../../runner/python'
import { PLAY_NEEDS, py, type PlayApi } from './api'
import { Blackjack } from './Blackjack'
import { Doodle } from './Doodle'
import { Fit } from './Fit'
import { Hangman } from './Hangman'
import { Life } from './Life'
import { ErrorNote } from './parts'
import { Rps } from './Rps'
import { Spam } from './Spam'
import { Wordle } from './Wordle'

type Loaded =
  | { status: 'loading' }
  | { status: 'ready'; code: string; has: Set<string>; gen: number }
  | {
      status: 'failed'
      code: string
      error: RunError
      gen: number
    }

/**
 * The Play panel: a game whose logic is the learner's own code. "You write the brain, the app draws the board."
 * The program is loaded once and the game calls its functions as the player clicks. Shortly after the code
 * changes, it's loaded again as a fresh game, so a function just written is the one that plays; Restart does it
 * straight away.
 */
export function PlayPanel({ kind, code }: { kind: PlayKind; code: string }) {
  const rerun = kind === 'rps'
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' })
  const [crash, setCrash] = useState<{ what: string; error: RunError } | null>(null)
  const [printed, setPrinted] = useState('')
  const codeRef = useRef(code)
  useLayoutEffect(() => {
    codeRef.current = code
  }, [code])
  const gen = useRef(0)

  const load = useCallback(async () => {
    const src = codeRef.current
    const r = await playLoad(src)
    gen.current++
    setCrash(null)
    setPrinted(r.stdout)
    if (!r.ok) {
      setLoaded({ status: 'failed', code: src, error: r.error!, gen: gen.current })
      return
    }
    const names = PLAY_NEEDS[kind]
    const has = names.length ? await playCall<string[]>(`__ga_has(${names.map((n) => py(n)).join(', ')})`) : null
    setLoaded({ status: 'ready', code: src, has: new Set(has?.value ?? []), gen: gen.current })
  }, [kind])

  useEffect(() => {
    if (rerun) return
    void (async () => {
      await load()
    })()
  }, [load, rerun])

  const restart = () => {
    setLoaded({ status: 'loading' })
    void load()
  }

  const call = useCallback(async <T,>(src: string, what: string): Promise<T | null> => {
    const r = await playCall<T>(src)
    if (r.stdout) setPrinted((p) => trimLog(p + r.stdout))
    if (!r.ok) {
      setCrash({ what, error: r.error! })
      return null
    }
    setCrash((c) => (c?.what === what ? null : c))
    return r.value
  }, [])

  const reload = useCallback(async (values: Record<string, string>) => {
    const r = await playLoad(codeRef.current, values)
    if (!r.ok) setCrash({ what: 'Your program', error: r.error! })
    else setCrash(null)
    return { ok: r.ok, stdout: r.stdout }
  }, [])

  const has = (name: string) => loaded.status === 'ready' && loaded.has.has(name)
  const api: PlayApi = { has, call, load: reload, code }
  const changed = !rerun && loaded.status !== 'loading' && loaded.code !== code

  // Keep the game on the latest code: once typing pauses, load it again, as a fresh game. A half-typed line
  // that isn't valid Python yet is skipped, so the board doesn't flash an error mid-word.
  useEffect(() => {
    if (!changed) return
    const t = setTimeout(() => {
      void (async () => {
        const src = codeRef.current
        if (await compiles(src)) await load()
      })()
    }, RELOAD_MS)
    return () => clearTimeout(t)
  }, [changed, code, load])

  let body: ReactNode
  if (rerun) body = <Rps api={api} />
  else if (loaded.status === 'loading') body = <p className="ga-play-empty">Loading your program…</p>
  else if (loaded.status === 'failed') body = <ErrorNote what="Your program" error={loaded.error} />
  else {
    const Game = {
      hangman: Hangman,
      wordle: Wordle,
      blackjack: Blackjack,
      life: Life,
      doodle: Doodle,
      fit: Fit,
      spam: Spam,
    }[kind as Exclude<PlayKind, 'rps'>]
    body = <Game key={loaded.gen} api={api} />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-own-keys>
      {!rerun && (
        <div className="flex items-center gap-2">
          <span className="text-caption text-faint">
            {changed ? 'Your code changed. Picking it up…' : 'Running your code.'}
          </span>
          <button
            type="button"
            className={`ga-btn ga-btn--sm ml-auto ${changed ? 'ga-btn--primary' : 'ga-btn--ghost'}`}
            onClick={restart}
            disabled={loaded.status === 'loading'}
          >
            <RotateCcw size={14} aria-hidden /> Restart
          </button>
        </div>
      )}
      {crash && <ErrorNote what={crash.what} error={crash.error} />}
      {body}
      {printed.trim() && !rerun && (
        <div className="ga-output">
          <div className="ga-code-header">
            <span>Printed</span>
          </div>
          <pre className="max-h-28!">{printed.replace(/\n$/, '')}</pre>
        </div>
      )}
    </div>
  )
}

/** How long after the last keystroke the game picks up the new code. */
const RELOAD_MS = 1200

async function compiles(src: string) {
  const r = await runPython('', [{ call: `compile(${py(src)}, "main.py", "exec") is not None`, expect: 'True' }])
  return !!r.tests[0]?.passed
}

function trimLog(s: string) {
  const lines = s.split('\n')
  return lines.length > 60 ? lines.slice(-60).join('\n') : s
}
