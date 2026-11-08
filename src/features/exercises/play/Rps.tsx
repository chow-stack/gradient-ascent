import { useState } from 'react'
import { inline } from '../inline'
import { py, type PlayApi } from './api'
import { randomItem } from './words'

const MOVES = [
  { id: 'rock', icon: '✊', label: 'Rock' },
  { id: 'paper', icon: '✋', label: 'Paper' },
  { id: 'scissors', icon: '✌️', label: 'Scissors' },
] as const
type Move = (typeof MOVES)[number]['id']

type Round = {
  player: Move
  computer: Move
  printed: string
  result?: unknown
  reason?: unknown
  winner?: unknown
}

const READ = `{k: globals().get(k) for k in ("result", "reason", "wins", "losses", "winner")}`
const icon = (m: Move) => MOVES.find((x) => x.id === m)!.icon
const RESULT: Record<string, { text: string; tone: string }> = {
  win: { text: 'You win', tone: 'text-success' },
  lose: { text: 'You lose', tone: 'text-danger' },
  draw: { text: 'Draw', tone: 'text-muted' },
}

/**
 * Unit 1 has no functions or loops, so each round reruns the whole program with `player` and `computer` set at
 * its top. The score it ends with is carried into the next round, so the program plays a whole match.
 */
export function Rps({ api }: { api: PlayApi }) {
  const [round, setRound] = useState<Round | null>(null)
  const [score, setScore] = useState<{ wins: number; losses: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const over = round?.winner === 'you' || round?.winner === 'computer'

  const play = async (player: Move) => {
    setBusy(true)
    const computer = randomItem(MOVES).id
    const values: Record<string, string> = { player: py(player), computer: py(computer) }
    if (score) {
      values.wins = String(score.wins)
      values.losses = String(score.losses)
    }
    const r = await api.load(values)
    if (!r.ok) {
      setRound(null)
      setBusy(false)
      return
    }
    const v = (await api.call<Record<string, unknown>>(READ, 'Your program')) ?? {}
    const wins = Number.isInteger(v.wins) ? (v.wins as number) : null
    const losses = Number.isInteger(v.losses) ? (v.losses as number) : null
    setScore(wins !== null && losses !== null ? { wins, losses } : null)
    setRound({ player, computer, printed: r.stdout, result: v.result, reason: v.reason, winner: v.winner })
    setBusy(false)
  }

  const reset = () => {
    setRound(null)
    setScore(null)
  }

  const result = typeof round?.result === 'string' ? RESULT[round.result] : undefined

  return (
    <div className="flex flex-col gap-4">
      <div className="ga-play-board flex flex-col items-center gap-3 py-5">
        {score && (
          <p className="text-small text-muted tabular-nums">
            You <span className="font-semibold text-text">{score.wins}</span>
            <span className="mx-2 text-faint">–</span>
            <span className="font-semibold text-text">{score.losses}</span> Computer
          </p>
        )}
        {round ? (
          <>
            <div className="flex items-center gap-5 text-[52px] leading-none" aria-hidden>
              <span>{icon(round.player)}</span>
              <span className="text-small text-faint">vs</span>
              <span className="-scale-x-100">{icon(round.computer)}</span>
            </div>
            <p className="sr-only">
              You played {round.player}. The computer played {round.computer}.
            </p>
            {result ? (
              <p className={`text-h3 font-semibold ${result.tone}`}>{result.text}</p>
            ) : (
              <p className="text-small text-faint">
                {inline('Set `result` to "win", "lose" or "draw" to see who won.')}
              </p>
            )}
            {typeof round.reason === 'string' && round.reason && (
              <p className="text-small text-muted first-letter:uppercase">{round.reason}</p>
            )}
          </>
        ) : (
          <p className="py-6 text-muted">Pick your move.</p>
        )}
      </div>

      {over ? (
        <div className="flex flex-col items-center gap-3">
          <p className="font-semibold">
            {round?.winner === 'you' ? 'You won the match!' : 'The computer won the match.'}
          </p>
          <button type="button" className="ga-btn ga-btn--primary" onClick={reset}>
            New match
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Your move">
          {MOVES.map((m) => (
            <button key={m.id} type="button" className="ga-play-move" disabled={busy} onClick={() => play(m.id)}>
              <span className="text-[28px] leading-none" aria-hidden>
                {m.icon}
              </span>
              {m.label}
            </button>
          ))}
        </div>
      )}

      {round?.printed.trim() && (
        <div className="ga-output">
          <div className="ga-code-header">
            <span>Your program printed</span>
          </div>
          <pre>{round.printed.replace(/\n$/, '')}</pre>
        </div>
      )}
      {score && !over && (
        <button type="button" className="ga-btn ga-btn--ghost ga-btn--sm self-center" onClick={reset}>
          Reset score
        </button>
      )}
    </div>
  )
}
