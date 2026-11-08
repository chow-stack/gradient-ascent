import { Eraser, Plus } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import { cellsBetween, py, type PlayApi } from './api'
import { Needs } from './parts'

const SIZE = 5
type Grid = number[][]

const blank = (): Grid => Array.from({ length: SIZE }, () => new Array(SIZE).fill(0))
const NP = '__import__("numpy")'
const vec = (g: Grid) => `${NP}.array(${py(g)}, dtype=float).reshape(-1)`

/**
 * Unit 5: draw a doodle and the learner's predict() names it, with distances() picking out the training doodle it
 * matched. When it's wrong, teaching it adds the drawing to `train` and `labels`, so the next guess knows more.
 */
export function Doodle({ api }: { api: PlayApi }) {
  const [grid, setGrid] = useState<Grid>(blank)
  const [known, setKnown] = useState<{ train: Grid[]; labels: string[] } | null>(null)
  const [guess, setGuess] = useState<{ label: string; nearest: number | null } | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [taught, setTaught] = useState('')
  const paint = useRef<number | null>(null)
  const gridRef = useRef(grid)
  const { call, has } = api

  const readKnown = async () => {
    const k = await call<{ train: Grid[]; labels: string[] }>(
      '{"train": train.tolist(), "labels": [str(x) for x in labels]}',
      'Reading `train` and `labels`',
    )
    setKnown(k)
  }

  useEffect(() => {
    void (async () => {
      await readKnown()
    })()
    // Only when the game is first loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ink = (g: Grid) => g.some((row) => row.some(Boolean))

  const predict = async (g: Grid) => {
    if (!ink(g) || !has('predict') || !has('flatten')) return setGuess(null)
    const label = await call<string>(`str(predict(flatten(train), labels, ${vec(g)}))`, '`predict()`')
    if (label === null) return setGuess(null)
    let nearest: number | null = null
    if (has('distances')) {
      const d = await call<number[]>(`distances(flatten(train), ${vec(g)})`, '`distances()`')
      if (Array.isArray(d) && d.length) nearest = d.indexOf(Math.min(...d))
    }
    setGuess({ label, nearest })
  }

  const update = (g: Grid) => {
    gridRef.current = g
    setGrid(g)
  }

  const last = useRef<{ x: number; y: number } | null>(null)

  const cellAt = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.floor(((e.clientX - r.left) / r.width) * SIZE)
    const y = Math.floor(((e.clientY - r.top) / r.height) * SIZE)
    return { x: Math.min(SIZE - 1, Math.max(0, x)), y: Math.min(SIZE - 1, Math.max(0, y)) }
  }
  const paintTo = (to: { x: number; y: number }) => {
    const g = gridRef.current.map((r) => r.slice())
    for (const c of cellsBetween(last.current ?? to, to)) g[c.y][c.x] = paint.current!
    last.current = to
    update(g)
  }
  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const c = cellAt(e)
    paint.current = gridRef.current[c.y][c.x] ? 0 : 1
    last.current = null
    setTaught('')
    paintTo(c)
  }
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (paint.current !== null) paintTo(cellAt(e))
  }
  const up = () => {
    if (paint.current === null) return
    paint.current = null
    last.current = null
    void predict(gridRef.current)
  }

  const teach = async (label: string) => {
    const name = label.trim().toLowerCase()
    if (!name || !ink(grid)) return
    const ok = await call(
      `train = ${NP}.concatenate([train, ${NP}.array([${py(grid)}], dtype=float)])\nlabels = ${NP}.append(labels, ${py(name)})\nlen(labels)`,
      'Teaching',
    )
    if (ok === null) return
    setNewLabel('')
    setTaught(name)
    await readKnown()
    await predict(grid)
  }

  const clear = () => {
    update(blank())
    setGuess(null)
    setTaught('')
  }

  const onNew = (e: FormEvent) => {
    e.preventDefault()
    void teach(newLabel)
  }

  if (!has('predict') || !has('flatten')) return <Needs names={['flatten()', 'predict()']} to="name your doodles" />
  if (!known) return null

  const labels = [...new Set(known.labels)]
  const match = guess?.nearest != null ? known.train[guess.nearest] : null

  return (
    <div className="flex flex-col gap-4">
      <div className="ga-play-board flex flex-wrap items-center justify-center gap-6 px-4 py-5">
        <div className="flex flex-col items-center gap-2">
          <div
            className="ga-play-doodle"
            role="grid"
            aria-label="Your doodle. Click or drag to draw."
            style={{ touchAction: 'none' }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          >
            {grid.map((row, y) =>
              row.map((v, x) => (
                <button
                  key={`${y}-${x}`}
                  type="button"
                  className="ga-play-pixel"
                  data-on={v ? '' : undefined}
                  aria-label={`Row ${y + 1}, column ${x + 1}, ${v ? 'ink' : 'blank'}`}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return
                    e.preventDefault()
                    const g = grid.map((r) => r.slice())
                    g[y][x] = v ? 0 : 1
                    update(g)
                    void predict(g)
                  }}
                />
              )),
            )}
          </div>
          <button type="button" className="ga-btn ga-btn--ghost ga-btn--sm" onClick={clear} disabled={!ink(grid)}>
            <Eraser size={14} aria-hidden /> Clear
          </button>
        </div>

        <div className="flex min-w-[150px] flex-col items-center gap-3 text-center">
          {guess ? (
            <>
              <p className="text-small text-muted">Looks like a</p>
              <p className="text-h2 font-semibold">{guess.label}</p>
              {match && (
                <div className="flex flex-col items-center gap-1.5">
                  <Thumb grid={match} />
                  <p className="text-caption text-faint">Closest doodle it knows</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-small text-muted">Draw something.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-small text-muted">
          {taught ? `Learned that one as a ${taught}.` : guess ? 'Wrong? Tell it what it is:' : 'Teach it a doodle:'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {labels.map((l) => (
            <button key={l} type="button" className="ga-play-chip" disabled={!ink(grid)} onClick={() => teach(l)}>
              {l}
            </button>
          ))}
          <form onSubmit={onNew} className="flex items-center gap-1">
            <input
              className="ga-play-input"
              placeholder="new label"
              value={newLabel}
              maxLength={16}
              onChange={(e) => setNewLabel(e.target.value)}
              aria-label="A new label"
            />
            <button
              type="submit"
              className="ga-icon-btn size-8!"
              disabled={!ink(grid) || !newLabel.trim()}
              aria-label="Teach this label"
            >
              <Plus size={16} aria-hidden />
            </button>
          </form>
        </div>
        <p className="text-caption text-faint tabular-nums">It knows {known.train.length} doodles.</p>
      </div>
    </div>
  )
}

function Thumb({ grid }: { grid: Grid }) {
  return (
    <div className="ga-play-doodle ga-play-doodle--thumb" aria-hidden>
      {grid.map((row, y) =>
        row.map((v, x) => <span key={`${y}-${x}`} className="ga-play-pixel" data-on={v ? '' : undefined} />),
      )}
    </div>
  )
}
