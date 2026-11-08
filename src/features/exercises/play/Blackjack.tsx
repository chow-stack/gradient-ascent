import { useState } from 'react'
import type { PlayApi } from './api'
import { Needs } from './parts'

type Table = { you: string[]; youTotal: number; dealer: string[]; dealerTotal: number; left: number }
type Phase = 'idle' | 'playing' | 'done'

const STATE = `{"you": [repr(c) for c in _ga_you.cards], "youTotal": _ga_you.total(),
 "dealer": [repr(c) for c in _ga_dealer.cards], "dealerTotal": _ga_dealer.total(), "left": len(_ga_deck)}`

const DEAL = `
if "_ga_deck" not in globals() or len(_ga_deck) < 15:
    _ga_deck = Deck()
    _ga_deck.shuffle()
_ga_you = Hand([])
_ga_dealer = Hand([])
for _ga_i in range(2):
    _ga_you.add(_ga_deck.deal())
    _ga_dealer.add(_ga_deck.deal())
${STATE}`

const RESULT: Record<string, { text: string; tone: string }> = {
  win: { text: 'You win', tone: 'text-success' },
  lose: { text: 'Dealer wins', tone: 'text-danger' },
  push: { text: 'Push', tone: 'text-muted' },
}

/** Unit 4: the learner's Card, Deck and Hand classes run the table; dealer_turn() and outcome() finish each hand. */
export function Blackjack({ api }: { api: PlayApi }) {
  const [table, setTable] = useState<Table | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<string | null>(null)
  const [tally, setTally] = useState({ win: 0, lose: 0, push: 0 })
  const [busy, setBusy] = useState(false)
  const { call, has } = api
  const ready = has('Card') && has('Deck') && has('Hand')
  const canStand = has('dealer_turn') && has('outcome')

  const act = async (src: string, what: string) => {
    setBusy(true)
    const t = await call<Table>(src, what)
    if (t) setTable(t)
    setBusy(false)
    return t
  }

  const finish = async (stood: boolean) => {
    if (stood) {
      const after = await act(`dealer_turn(_ga_dealer, _ga_deck)\n${STATE}`, '`dealer_turn()`')
      if (!after) return
    }
    const r = await call<string>('outcome(_ga_you, _ga_dealer)', '`outcome()`')
    setPhase('done')
    if (typeof r === 'string' && r in RESULT) {
      setResult(r)
      setTally((x) => ({ ...x, [r]: x[r as keyof typeof x] + 1 }))
    } else setResult(r === null ? null : `bad:${JSON.stringify(r)}`)
  }

  const deal = async () => {
    setResult(null)
    const t = await act(DEAL, 'Dealing')
    setPhase(t ? 'playing' : 'idle')
  }

  const hit = async () => {
    const t = await act(`_ga_you.add(_ga_deck.deal())\n${STATE}`, 'Hitting')
    if (t && t.youTotal > 21) {
      if (canStand) await finish(false)
      else setPhase('done')
    }
  }

  const stand = async () => {
    await finish(true)
  }

  if (!ready) return <Needs names={['Card', 'Deck', 'Hand']} to="deal" />

  const hideHole = phase === 'playing'
  const shown = result ? RESULT[result] : undefined

  return (
    <div className="flex flex-col gap-4">
      <div className="ga-play-board ga-play-felt flex flex-col gap-5 px-4 py-5">
        <HandRow
          label="Dealer"
          cards={table?.dealer ?? []}
          total={table && !hideHole ? table.dealerTotal : null}
          hideSecond={hideHole}
        />
        <HandRow label="You" cards={table?.you ?? []} total={table ? table.youTotal : null} />
        <div className="flex min-h-7 items-center justify-center text-center">
          {phase === 'idle' && <span className="text-small text-muted">Press Deal to start.</span>}
          {phase === 'done' && shown && <span className={`text-h3 font-semibold ${shown.tone}`}>{shown.text}</span>}
          {phase === 'done' && !shown && table && table.youTotal > 21 && (
            <span className="text-h3 font-semibold text-danger">Bust</span>
          )}
          {phase === 'done' && result?.startsWith('bad:') && (
            <span className="text-small text-muted">
              outcome() should give back "win", "lose" or "push". It gave {result.slice(4)}.
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {phase === 'playing' ? (
          <>
            <button type="button" className="ga-btn ga-btn--primary" disabled={busy} onClick={hit}>
              Hit
            </button>
            <button
              type="button"
              className="ga-btn ga-btn--secondary"
              disabled={busy || !canStand}
              onClick={stand}
              title={canStand ? undefined : 'Write dealer_turn() and outcome() first'}
            >
              Stand
            </button>
          </>
        ) : (
          <button type="button" className="ga-btn ga-btn--primary" disabled={busy} onClick={deal}>
            Deal
          </button>
        )}
      </div>
      {phase === 'playing' && !canStand && <Needs names={['dealer_turn()', 'outcome()']} to="stand" />}

      {(tally.win || tally.lose || tally.push || table) && (
        <p className="text-center text-caption text-faint tabular-nums">
          Won {tally.win} · Lost {tally.lose} · Pushed {tally.push}
          {table && ` · ${table.left} cards left in the deck`}
        </p>
      )}
    </div>
  )
}

function HandRow({
  label,
  cards,
  total,
  hideSecond,
}: {
  label: string
  cards: string[]
  total: number | null
  hideSecond?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-baseline gap-2 text-small">
        <span className="font-semibold">{label}</span>
        {total !== null && <span className="text-muted tabular-nums">{total}</span>}
        {total !== null && total > 21 && <span className="font-semibold text-danger">Bust</span>}
      </p>
      <div className="flex min-h-[76px] flex-wrap gap-2">
        {cards.map((c, i) => (
          <PlayingCard key={i} text={c} hidden={hideSecond && i === 1} />
        ))}
      </div>
    </div>
  )
}

const SUITS = '♠♥♦♣'

function PlayingCard({ text, hidden }: { text: string; hidden?: boolean }) {
  if (hidden) return <span className="ga-play-card ga-play-card--back" aria-label="Face-down card" />
  const suit = SUITS.includes(text.slice(-1)) ? text.slice(-1) : ''
  const rank = suit ? text.slice(0, -1) : text
  const red = suit === '♥' || suit === '♦'
  return (
    <span className="ga-play-card" data-red={red || undefined} aria-label={text}>
      <span className="text-[17px] leading-none font-semibold">{rank}</span>
      {suit && <span className="text-[22px] leading-none">{suit}</span>}
    </span>
  )
}
