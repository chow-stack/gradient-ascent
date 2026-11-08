import { Bot, Delete, Lightbulb } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { inline } from '../inline'
import { KEY_ROWS, py, type PlayApi } from './api'
import { Needs } from './parts'
import { randomItem, WORDLE_WORDS } from './words'

const ROWS = 6
const RANK: Record<string, number> = { '-': 1, Y: 2, G: 3 }
type Row = { guess: string; pattern: string }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const validPattern = (p: unknown): p is string => typeof p === 'string' && /^[GY-]{5}$/.test(p)

/**
 * Unit 3: the learner's score() colours each guess, remaining() narrows down the words that could still be the
 * answer, and pick() chooses a guess, for a hint or for a bot that solves the puzzle.
 */
export function Wordle({ api }: { api: PlayApi }) {
  const [answer, setAnswer] = useState(() => randomItem(WORDLE_WORDS))
  const [rows, setRows] = useState<Row[]>([])
  const [typed, setTyped] = useState('')
  const [left, setLeft] = useState<string[] | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const { call, has } = api

  useEffect(() => box.current?.focus({ preventScroll: true }), [])

  const solved = rows.some((r) => r.pattern === 'GGGGG')
  const over = solved || rows.length >= ROWS

  /** Scores a guess and narrows the word list. Returns the new list, or null if score() went wrong. */
  const submit = async (guess: string, list: string[] | null, done: Row[]) => {
    const pattern = await call<string>(`score(${py(guess)}, ${py(answer)})`, '`score()`')
    if (pattern === null) return null
    if (!validPattern(pattern)) {
      setNote(
        `\`score()\` should give back 5 letters made of G, Y and -, like "GY--G". It gave ${JSON.stringify(pattern)}.`,
      )
      return null
    }
    const nextRows = [...done, { guess, pattern }]
    setRows(nextRows)
    setTyped('')
    let nextLeft = list
    if (has('remaining')) {
      const r = await call<string[]>(
        `remaining(${py(list ?? WORDLE_WORDS)}, ${py(guess)}, ${py(pattern)})`,
        '`remaining()`',
      )
      nextLeft = Array.isArray(r) ? r : null
      setLeft(nextLeft)
    }
    return { rows: nextRows, left: nextLeft }
  }

  const enter = async () => {
    if (busy || over) return
    if (typed.length < 5) return setNote('Five letters, please.')
    if (!WORDLE_WORDS.includes(typed)) return setNote(`"${typed}" isn't in the word list.`)
    setNote('')
    setBusy(true)
    await submit(typed, left, rows)
    setBusy(false)
  }

  const type = (k: string) => {
    if (busy || over) return
    setNote('')
    if (k === 'enter') void enter()
    else if (k === 'back') setTyped((t) => t.slice(0, -1))
    else if (typed.length < 5) setTyped((t) => t + k)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === 'Enter') type('enter')
    else if (e.key === 'Backspace') type('back')
    else if (/^[a-z]$/i.test(e.key)) type(e.key.toLowerCase())
    else return
    e.preventDefault()
  }

  const pick = async (list: string[]) => {
    const w = await call<string>(`pick(${py(list)})`, '`pick()`')
    if (typeof w !== 'string' || !list.includes(w)) {
      if (w !== null) setNote(`\`pick()\` should give back one of the words. It gave ${JSON.stringify(w)}.`)
      return null
    }
    return w
  }

  const hint = async () => {
    setBusy(true)
    const w = await pick(left ?? WORDLE_WORDS)
    if (w) setTyped(w)
    setBusy(false)
    box.current?.focus({ preventScroll: true })
  }

  const runBot = async () => {
    setBusy(true)
    setNote('')
    let state = { rows, left }
    while (state.rows.length < ROWS && !state.rows.some((r) => r.pattern === 'GGGGG')) {
      const w = await pick(state.left ?? WORDLE_WORDS)
      if (!w) break
      if (state.rows.some((r) => r.guess === w)) {
        setNote(`The bot picked "${w}" again, so it stopped.`)
        break
      }
      setTyped(w)
      await wait(350)
      const next = await submit(w, state.left, state.rows)
      if (!next) break
      state = next
      if (!next.left?.length) break
      await wait(300)
    }
    setBusy(false)
  }

  const newWord = () => {
    setAnswer(randomItem(WORDLE_WORDS))
    setRows([])
    setTyped('')
    setLeft(null)
    setNote('')
    box.current?.focus({ preventScroll: true })
  }

  if (!has('score')) return <Needs names={['score()']} to="colour the guesses" />

  const keys: Record<string, string> = {}
  for (const r of rows)
    r.guess.split('').forEach((c, i) => {
      if ((RANK[r.pattern[i]] ?? 0) > (RANK[keys[c]] ?? 0)) keys[c] = r.pattern[i]
    })

  return (
    <div
      ref={box}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-4 outline-none"
      aria-label="Wordle. Type a guess and press Enter."
    >
      <div className="ga-play-board flex flex-col items-center gap-1.5 py-4">
        {Array.from({ length: ROWS }, (_, i) => {
          const row = rows[i]
          const text = row ? row.guess : i === rows.length ? typed : ''
          return (
            <div key={i} className="flex gap-1.5">
              {Array.from({ length: 5 }, (_, j) => (
                <span
                  key={j}
                  className="ga-play-tile ga-play-tile--lg"
                  data-state={
                    row ? { G: 'green', Y: 'yellow', '-': 'grey' }[row.pattern[j]] : text[j] ? 'typed' : 'empty'
                  }
                >
                  {text[j] ?? ''}
                </span>
              ))}
            </div>
          )
        })}
      </div>

      <div className="flex min-h-6 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-small">
        {solved ? (
          <span className="font-semibold text-success">Solved in {rows.length}.</span>
        ) : over ? (
          <span className="font-semibold text-danger">
            It was <span className="font-mono">{answer}</span>.
          </span>
        ) : note ? (
          <span className="text-muted">{inline(note)}</span>
        ) : left ? (
          <span className="text-muted">
            {left.length === 1 ? '1 word left' : `${left.length} words left`}
            {left.length > 1 && left.length <= 6 && `: ${left.join(', ')}`}
          </span>
        ) : rows.length > 0 && !has('remaining') ? (
          <Needs names={['remaining()']} to="count the words left" />
        ) : null}
      </div>

      <div className="flex flex-col items-center gap-1.5" role="group" aria-label="Keyboard">
        {KEY_ROWS.map((row, r) => (
          <div key={row} className="flex gap-1.5">
            {r === 2 && (
              <button
                type="button"
                className="ga-play-key ga-play-key--wide"
                onClick={() => type('enter')}
                disabled={busy || over}
              >
                Enter
              </button>
            )}
            {row.split('').map((k) => (
              <button
                key={k}
                type="button"
                className="ga-play-key"
                data-state={{ G: 'hit', Y: 'near', '-': 'miss' }[keys[k]]}
                disabled={busy || over}
                onClick={() => type(k)}
              >
                {k}
              </button>
            ))}
            {r === 2 && (
              <button
                type="button"
                className="ga-play-key ga-play-key--wide"
                onClick={() => type('back')}
                disabled={busy || over}
                aria-label="Delete"
              >
                <Delete size={16} aria-hidden />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {over ? (
          <button type="button" className="ga-btn ga-btn--primary ga-btn--sm" onClick={newWord}>
            New word
          </button>
        ) : (
          <>
            <button
              type="button"
              className="ga-btn ga-btn--secondary ga-btn--sm"
              onClick={runBot}
              disabled={busy || !has('pick') || !has('remaining')}
              title={has('pick') && has('remaining') ? undefined : 'Write remaining() and pick() first'}
            >
              <Bot size={15} aria-hidden /> Let your bot solve it
            </button>
            <button
              type="button"
              className="ga-btn ga-btn--ghost ga-btn--sm"
              onClick={hint}
              disabled={busy || !has('pick')}
              title={has('pick') ? undefined : 'Write pick() first'}
            >
              <Lightbulb size={15} aria-hidden /> Hint
            </button>
          </>
        )}
      </div>
    </div>
  )
}
