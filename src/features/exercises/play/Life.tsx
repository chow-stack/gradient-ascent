import { Dices, Eraser, Pause, Play, StepForward } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { cellsBetween, py, type PlayApi } from './api'
import { Needs } from './parts'

const ROWS = 26
const COLS = 40
const TICK_MS = 110

type Grid = number[][]

const empty = (): Grid => Array.from({ length: ROWS }, () => new Array(COLS).fill(0))
const arr = (g: Grid) => `__import__("numpy").array(${py(g)})`
const isGrid = (g: unknown): g is Grid =>
  Array.isArray(g) && g.length === ROWS && g.every((r) => Array.isArray(r) && r.length === COLS)

const PATTERNS: Record<string, Grid> = {
  Glider: [
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 1],
  ],
  Blinker: [[1, 1, 1]],
  Pulsar: (() => {
    const g = Array.from({ length: 13 }, () => new Array(13).fill(0))
    for (const a of [0, 5, 7, 12])
      for (const b of [2, 3, 4, 8, 9, 10]) {
        g[a][b] = 1
        g[b][a] = 1
      }
    return g
  })(),
  'Glider gun': [
    '........................#...........',
    '......................#.#...........',
    '............##......##............##',
    '...........#...#....##............##',
    '##........#.....#...##..............',
    '##........#...#.##....#.#...........',
    '..........#.....#.......#...........',
    '...........#...#....................',
    '............##......................',
  ].map((r) => r.split('').map((c) => (c === '#' ? 1 : 0))),
}

/**
 * Unit 5: the learner's step() runs the world, one NumPy call per frame. random_world() fills it, stamp() drops
 * in patterns, and neighbours() can be shown on the board.
 */
export function Life({ api }: { api: PlayApi }) {
  const [grid, setGrid] = useState<Grid>(empty)
  const [gen, setGen] = useState(0)
  const [running, setRunning] = useState(false)
  const [counts, setCounts] = useState<Grid | null>(null)
  const [showCounts, setShowCounts] = useState(false)
  const [note, setNote] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const gridRef = useRef(grid)
  const runRef = useRef(false)
  const paint = useRef<number | null>(null)
  const [width, setWidth] = useState(0)
  const { call, has } = api

  useLayoutEffect(() => {
    gridRef.current = grid
  }, [grid])

  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cell = Math.max(4, Math.floor(width / COLS))

  useEffect(() => {
    const c = canvas.current
    if (!c || !width) return
    const dpr = window.devicePixelRatio || 1
    c.width = COLS * cell * dpr
    c.height = ROWS * cell * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    const css = getComputedStyle(c)
    ctx.fillStyle = css.getPropertyValue('--color-code-bg')
    ctx.fillRect(0, 0, COLS * cell, ROWS * cell)
    ctx.strokeStyle = css.getPropertyValue('--color-border')
    ctx.lineWidth = 1
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath()
      ctx.moveTo(x * cell + 0.5, 0)
      ctx.lineTo(x * cell + 0.5, ROWS * cell)
      ctx.stroke()
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * cell + 0.5)
      ctx.lineTo(COLS * cell, y * cell + 0.5)
      ctx.stroke()
    }
    ctx.fillStyle = css.getPropertyValue('--color-success')
    grid.forEach((row, y) =>
      row.forEach((v, x) => {
        if (v) ctx.fillRect(x * cell + 1.5, y * cell + 1.5, cell - 2, cell - 2)
      }),
    )
    if (showCounts && counts && cell >= 11) {
      ctx.font = `${Math.floor(cell * 0.6)}px ${css.getPropertyValue('--font-mono')}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      counts.forEach((row, y) =>
        row.forEach((n, x) => {
          if (!n) return
          ctx.fillStyle = grid[y][x]
            ? css.getPropertyValue('--color-on-success')
            : css.getPropertyValue('--color-muted')
          ctx.fillText(String(n), x * cell + cell / 2 + 0.5, y * cell + cell / 2 + 1)
        }),
      )
    }
  }, [grid, cell, width, counts, showCounts])

  const refreshCounts = useCallback(
    async (g: Grid) => {
      const n = await call<Grid>(`neighbours(${arr(g)})`, '`neighbours()`')
      setCounts(isGrid(n) ? n : null)
    },
    [call],
  )

  const setWorld = (g: Grid, generation = 0) => {
    setGrid(g)
    setGen(generation)
    if (showCounts) void refreshCounts(g)
  }

  const tick = async () => {
    const next = await call<Grid>(`step(${arr(gridRef.current)})`, '`step()`')
    if (!isGrid(next)) {
      if (next !== null) setNote(`step() should give back a grid the same shape as the one it got, ${ROWS} by ${COLS}.`)
      return false
    }
    setNote('')
    setGrid(next)
    setGen((n) => n + 1)
    if (showCounts) await refreshCounts(next)
    return true
  }

  const play = async () => {
    runRef.current = true
    setRunning(true)
    while (runRef.current) {
      const started = performance.now()
      if (!(await tick())) break
      await new Promise((r) => setTimeout(r, Math.max(0, TICK_MS - (performance.now() - started))))
    }
    runRef.current = false
    setRunning(false)
  }

  useEffect(
    () => () => {
      runRef.current = false
    },
    [],
  )

  const pause = () => {
    runRef.current = false
  }

  const random = async () => {
    const seed = Math.floor(Math.random() * 10_000)
    const g = await call<Grid>(`random_world(${ROWS}, ${COLS}, 0.3, ${seed})`, '`random_world()`')
    if (isGrid(g)) setWorld(g)
    else if (g !== null) setNote(`random_world(${ROWS}, ${COLS}, ...) should give back a ${ROWS} by ${COLS} grid.`)
  }

  const stamp = async (name: string) => {
    const p = PATTERNS[name]
    const r = Math.floor((ROWS - p.length) / 2)
    const c = Math.floor((COLS - p[0].length) / 2)
    const g = await call<Grid>(`stamp(${arr(gridRef.current)}, ${arr(p)}, ${r}, ${c})`, '`stamp()`')
    if (isGrid(g)) setWorld(g, gen)
    else if (g !== null) setNote('stamp() should give back the whole grid, with the pattern in it.')
  }

  const toggleCounts = () => {
    const on = !showCounts
    setShowCounts(on)
    if (on) void refreshCounts(grid)
  }

  const at = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) / cell)
    const y = Math.floor((e.clientY - rect.top) / cell)
    return x >= 0 && x < COLS && y >= 0 && y < ROWS ? { x, y } : null
  }
  const last = useRef<{ x: number; y: number } | null>(null)
  const draw = (e: PointerEvent<HTMLCanvasElement>, start: boolean) => {
    const p = at(e)
    if (!p) return
    if (start) {
      e.currentTarget.setPointerCapture(e.pointerId)
      paint.current = gridRef.current[p.y][p.x] ? 0 : 1
      last.current = null
    }
    if (paint.current === null) return
    const g = gridRef.current.map((row) => row.slice())
    for (const c of cellsBetween(last.current ?? p, p)) g[c.y][c.x] = paint.current
    last.current = p
    gridRef.current = g
    setGrid(g)
  }
  const endDraw = () => {
    if (paint.current !== null && showCounts) void refreshCounts(gridRef.current)
    paint.current = null
    last.current = null
  }

  if (!has('step')) return <Needs names={['step()']} to="bring the world to life" />

  const population = grid.reduce((n, row) => n + row.reduce((a, b) => a + b, 0), 0)

  return (
    <div className="flex flex-col gap-3">
      <div ref={wrap} className="w-full">
        <canvas
          ref={canvas}
          className="ga-play-life mx-auto block"
          style={{ width: COLS * cell, height: ROWS * cell }}
          onPointerDown={(e) => draw(e, true)}
          onPointerMove={(e) => draw(e, false)}
          onPointerUp={endDraw}
          onPointerCancel={endDraw}
          aria-label={`Game of Life board, ${population} cells alive. Click cells to bring them to life.`}
          role="img"
        />
      </div>
      <p className="text-center text-caption text-faint tabular-nums">
        Generation {gen} · {population} alive
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {running ? (
          <button type="button" className="ga-btn ga-btn--primary ga-btn--sm" onClick={pause}>
            <Pause size={15} aria-hidden /> Pause
          </button>
        ) : (
          <button type="button" className="ga-btn ga-btn--primary ga-btn--sm" onClick={play}>
            <Play size={15} aria-hidden /> Play
          </button>
        )}
        <button
          type="button"
          className="ga-btn ga-btn--secondary ga-btn--sm"
          disabled={running}
          onClick={() => void tick()}
        >
          <StepForward size={15} aria-hidden /> Step
        </button>
        <button
          type="button"
          className="ga-btn ga-btn--ghost ga-btn--sm"
          disabled={running || !has('random_world')}
          onClick={random}
          title={has('random_world') ? undefined : 'Write random_world() first'}
        >
          <Dices size={15} aria-hidden /> Random
        </button>
        <button
          type="button"
          className="ga-btn ga-btn--ghost ga-btn--sm"
          disabled={running}
          onClick={() => setWorld(empty())}
        >
          <Eraser size={15} aria-hidden /> Clear
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {Object.keys(PATTERNS).map((name) => (
          <button
            key={name}
            type="button"
            className="ga-play-chip"
            disabled={running || !has('stamp')}
            onClick={() => stamp(name)}
            title={has('stamp') ? `Stamp a ${name.toLowerCase()} in the middle` : 'Write stamp() first'}
          >
            {name}
          </button>
        ))}
        <button
          type="button"
          className="ga-play-chip"
          aria-pressed={showCounts}
          disabled={!has('neighbours')}
          onClick={toggleCounts}
          title={has('neighbours') ? 'Show what neighbours() counts' : 'Write neighbours() first'}
        >
          Show counts
        </button>
      </div>
      {note && <p className="text-center text-small text-muted">{note}</p>}
    </div>
  )
}
