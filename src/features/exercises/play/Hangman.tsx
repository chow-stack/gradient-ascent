import { Bot, Heart } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { KEY_ROWS, py, type PlayApi } from './api'
import { Needs } from './parts'
import { HANGMAN_WORDS, randomItem } from './words'

type Board = { masked: string | null; misses: number | null; status: string | null }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Unit 2: the learner's masked(), misses() and status() run the game; next_guess() is a bot that plays it. */
export function Hangman({ api }: { api: PlayApi }) {
  const [word, setWord] = useState(() => randomItem(HANGMAN_WORDS))
  const [guessed, setGuessed] = useState('')
  const [board, setBoard] = useState<Board>({ masked: null, misses: null, status: null })
  const [lives, setLives] = useState(6)
  const [busy, setBusy] = useState(false)
  const [botNote, setBotNote] = useState('')
  const stopBot = useRef(false)
  const { call, has } = api

  const read = async (w: string, g: string): Promise<Board> => {
    const args = `${py(w)}, ${py(g)}`
    const masked = has('masked') ? await call<string>(`masked(${args})`, '`masked()`') : null
    const misses = has('misses') ? await call<number>(`misses(${args})`, '`misses()`') : null
    const status = has('status') ? await call<string>(`status(${args})`, '`status()`') : null
    const b = { masked, misses, status }
    setBoard(b)
    return b
  }

  useEffect(() => {
    let live = true
    void (async () => {
      const l = await call<number>('globals().get("lives", 6)', 'Your program')
      if (live && typeof l === 'number') setLives(l)
      if (live) await read(word, '')
    })()
    return () => {
      live = false
      stopBot.current = true
    }
    // Only when the game is first loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const over = board.status === 'won' || board.status === 'lost'

  const guess = async (letter: string, g = guessed) => {
    const next = g + letter
    setGuessed(next)
    return { b: await read(word, next), next }
  }

  const onKey = async (letter: string) => {
    if (busy || over || guessed.includes(letter)) return
    setBusy(true)
    await guess(letter)
    setBusy(false)
  }

  const runBot = async () => {
    setBusy(true)
    setBotNote('')
    stopBot.current = false
    let g = guessed
    for (let i = 0; i < 26 && !stopBot.current; i++) {
      const letter = await call<string>(`next_guess(${py(g)})`, '`next_guess()`')
      if (typeof letter !== 'string' || !/^[a-z]$/.test(letter) || g.includes(letter)) {
        if (letter !== null)
          setBotNote(`next_guess gave back ${JSON.stringify(letter)}, which isn't a new letter. The bot stopped.`)
        break
      }
      const { b, next } = await guess(letter, g)
      g = next
      if (b.status === 'won' || b.status === 'lost') break
      await wait(380)
    }
    setBusy(false)
  }

  const newWord = () => {
    let w = randomItem(HANGMAN_WORDS)
    while (w === word) w = randomItem(HANGMAN_WORDS)
    setWord(w)
    setGuessed('')
    setBotNote('')
    void read(w, '')
  }

  if (!has('masked')) return <Needs names={['masked()']} to="see the word" />

  return (
    <div className="flex flex-col gap-4">
      <div className="ga-play-board flex flex-col items-center gap-4 px-3 py-5">
        {board.misses !== null && (
          <div className="flex gap-1" aria-label={`${Math.max(0, lives - board.misses)} of ${lives} lives left`}>
            {Array.from({ length: lives }, (_, i) => (
              <Heart
                key={i}
                size={18}
                aria-hidden
                className={i < lives - board.misses! ? 'fill-danger text-danger' : 'text-faint opacity-50'}
              />
            ))}
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-1.5" aria-label="The word so far">
          {(board.masked ?? '').split('').map((c, i) => (
            <span key={i} className="ga-play-tile" data-state={c === '_' ? 'empty' : 'shown'}>
              {c === '_' ? '' : c}
            </span>
          ))}
        </div>
        {board.status === 'won' && <p className="font-semibold text-success">You got it.</p>}
        {board.status === 'lost' && (
          <p className="font-semibold text-danger">
            Out of lives. It was <span className="font-mono">{word}</span>.
          </p>
        )}
        {!has('status') && <Needs names={['status()']} to="end the game" />}
      </div>

      <div className="flex flex-col items-center gap-1.5" role="group" aria-label="Letters">
        {KEY_ROWS.map((row) => (
          <div key={row} className="flex gap-1.5">
            {row.split('').map((k) => {
              const used = guessed.includes(k)
              return (
                <button
                  key={k}
                  type="button"
                  className="ga-play-key"
                  data-state={used ? (word.includes(k) ? 'hit' : 'miss') : undefined}
                  disabled={busy || over || used}
                  onClick={() => onKey(k)}
                >
                  {k}
                </button>
              )
            })}
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
              disabled={busy || !has('next_guess')}
              onClick={runBot}
              title={has('next_guess') ? undefined : 'Write next_guess() first'}
            >
              <Bot size={15} aria-hidden /> Let your bot play
            </button>
            <button type="button" className="ga-btn ga-btn--ghost ga-btn--sm" disabled={busy} onClick={newWord}>
              New word
            </button>
          </>
        )}
      </div>
      {botNote && <p className="text-center text-small text-muted">{botNote}</p>}
    </div>
  )
}
