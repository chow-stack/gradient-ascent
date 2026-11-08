import { Pause, Play, RotateCcw, StepForward } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { py, type PlayApi } from './api'
import { Needs } from './parts'

type Pt = { x: number; y: number }
type WB = { w: number; b: number }

/** The data's box, and the part of the (w, b) plane the valley shows. */
const X = [-2, 2] as const
const Y = [-4, 4] as const
const W = [-4, 4] as const
const B = [-4, 4] as const
const RES = 51
const RATES = [0.01, 0.05, 0.2, 1]
const TICK_MS = 40
const MAX_STEPS = 3000
const MAX_POINTS = 40
/** Past this, training has clearly diverged. */
const OFF_MAP = 50

const round2 = (v: number) => Math.round(v * 100) / 100

function noisyLine(n: number, w: number, b: number, spread: number, seed: number): Pt[] {
  let s = seed
  const r = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647 - 0.5
  }
  return Array.from({ length: n }, (_, i) => {
    const x = -1.8 + (3.6 * i) / (n - 1) + r() * 0.2
    return { x: round2(x), y: round2(w * x + b + r() * spread) }
  })
}

const PRESETS: Record<string, Pt[]> = {
  Line: noisyLine(12, 1.5, -0.5, 0.6, 7),
  Noisy: noisyLine(16, -0.8, 1, 2.4, 11),
  Outlier: [...noisyLine(10, 0.5, 1.5, 0.4, 3), { x: 1.6, y: -3.5 }],
}

/** Helpers that run beside the learner's program. They call its functions and keep the replies JSON-safe. */
const HELPERS = `import numpy as _np

def _fit_safe(v):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return None
    return v if abs(v) < 1e6 else None

def _fit_view(w, b, xs, ys, cost):
    ends = predict(w, b, _np.array([${X[0]}.0, ${X[1]}.0]))
    out = [_fit_safe(ends[0]), _fit_safe(ends[1]), None]
    if cost and len(xs):
        out[2] = _fit_safe(loss(w, b, _np.array(xs), _np.array(ys)))
    return out

def _fit_step(w, b, xs, ys, lr, cost):
    s = step(w, b, _np.array(xs), _np.array(ys), lr)
    nw, nb = _fit_safe(s[0]), _fit_safe(s[1])
    if nw is None or nb is None:
        return [nw, nb, None, None, None]
    return [nw, nb] + _fit_view(nw, nb, xs, ys, cost)

def _fit_valley(xs, ys):
    xs, ys = _np.array(xs), _np.array(ys)
    return [[_fit_safe(loss(w, b, xs, ys)) for w in _np.linspace(${W[0]}, ${W[1]}, ${RES})]
            for b in _np.linspace(${B[1]}, ${B[0]}, ${RES})]

True`

type View = [number | null, number | null, number | null]
type StepReply = [number | null, number | null, ...View]

/** Percent across a box, for SVG drawn in a 100 by 100 viewBox. */
const across = (v: number, [lo, hi]: readonly [number, number]) => ((v - lo) / (hi - lo)) * 100
const down = (v: number, [lo, hi]: readonly [number, number]) => ((hi - v) / (hi - lo)) * 100

function hex(c: string): [number, number, number] {
  const h = c.trim().replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

/**
 * Unit 6: the learner's predict(), loss(), gradients(), step() and check() fit a line. Left, the data and the
 * line; right, the loss for every (w, b) with the path gradient descent takes down it.
 */
export function Fit({ api }: { api: PlayApi }) {
  const { call, has } = api
  const [ready, setReady] = useState(false)
  const [points, setPoints] = useState<Pt[]>(PRESETS.Line)
  const [wb, setWb] = useState<WB>({ w: 0, b: 0 })
  const [path, setPath] = useState<WB[]>([{ w: 0, b: 0 }])
  const [view, setView] = useState<View>([null, null, null])
  const [valley, setValley] = useState<(number | null)[][] | null>(null)
  const [lr, setLr] = useState(0.05)
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState(0)
  const [note, setNote] = useState('')
  const [checked, setChecked] = useState<[number | null, number | null] | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const runRef = useRef(false)
  const wbRef = useRef(wb)
  useLayoutEffect(() => {
    wbRef.current = wb
  }, [wb])

  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const data = `${py(xs)}, ${py(ys)}`
  const cost = has('loss') ? 'True' : 'False'

  useEffect(() => {
    void (async () => {
      if ((await call<boolean>(HELPERS, 'The Play panel')) === true) setReady(true)
    })()
  }, [call])

  const refresh = useCallback(
    async (at: WB) => {
      const v = await call<View>(`_fit_view(${at.w}, ${at.b}, ${data}, ${cost})`, '`predict()` or `loss()`')
      if (v) setView(v)
    },
    [call, data, cost],
  )

  useEffect(() => {
    if (!ready || !has('predict')) return
    void (async () => {
      await refresh(wbRef.current)
    })()
    // `has` changes identity every render; what it answers only changes on Restart, which remounts this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, refresh])

  useEffect(() => {
    if (!ready || !has('loss')) return
    void (async () => {
      if (!xs.length) return setValley(null)
      const v = await call<(number | null)[][]>(`_fit_valley(${data})`, '`loss()`')
      setValley(v)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, data, call])

  useEffect(() => {
    const c = canvas.current
    if (!c || !valley) return
    c.width = RES
    c.height = RES
    const ctx = c.getContext('2d')!
    const css = getComputedStyle(c)
    const [low, mid, sky] = ['--color-code-bg', '--color-progress-track', '--color-sky'].map((t) =>
      hex(css.getPropertyValue(t)),
    )
    const high = mid.map((v, k) => v + (sky[k] - v) * 0.4)
    const logs = valley.flat().flatMap((v) => (v === null ? [] : [Math.log(v + 1e-3)]))
    const lo = Math.min(...logs)
    const hi = Math.max(...logs)
    const img = ctx.createImageData(RES, RES)
    valley.forEach((row, r) =>
      row.forEach((v, col) => {
        // Low loss is dark, high is light.
        const t = v === null ? 1 : hi > lo ? (Math.log(v + 1e-3) - lo) / (hi - lo) : 0
        const [a, z, u] = t < 0.5 ? [low, mid, t * 2] : [mid, high, (t - 0.5) * 2]
        const i = (r * RES + col) * 4
        for (let k = 0; k < 3; k++) img.data[i + k] = a[k] + (z[k] - a[k]) * u
        img.data[i + 3] = 255
      }),
    )
    ctx.putImageData(img, 0, 0)
  }, [valley])

  const moveTo = (at: WB) => {
    setWb(at)
    wbRef.current = at
    setPath([at])
    setSteps(0)
    setNote('')
    void refresh(at)
  }

  const tick = async () => {
    if (!xs.length) {
      setNote('Add some points first.')
      return false
    }
    const { w, b } = wbRef.current
    const r = await call<StepReply>(`_fit_step(${w}, ${b}, ${data}, ${lr}, ${cost})`, '`step()`')
    if (!r) return false
    const [nw, nb, y0, y1, l] = r
    if (nw === null || nb === null) return offMap()
    const next = { w: nw, b: nb }
    wbRef.current = next
    setWb(next)
    setPath((p) => [...p, next])
    setView([y0, y1, l])
    setSteps((n) => n + 1)
    if (Math.abs(nw) > OFF_MAP || Math.abs(nb) > OFF_MAP) return offMap()
    if (Math.abs(nw - w) + Math.abs(nb - b) < 1e-4) {
      setNote('Settled. The steps have shrunk to almost nothing.')
      return false
    }
    setNote('')
    return true
  }

  const offMap = () => {
    setNote(
      `Each step overshot by more than the last, until w and b flew off the map. Try a smaller learning rate than ${lr}.`,
    )
    return false
  }

  const train = async () => {
    runRef.current = true
    setRunning(true)
    let n = steps
    while (runRef.current && n < MAX_STEPS) {
      const started = performance.now()
      if (!(await tick())) break
      n++
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

  /** Checks at two ordinary points, not where you are: near the bottom both partials are about 0, and noise wins. */
  const check = async () => {
    const r = await call<[number | null, number | null]>(
      `_e = [check(0.7, -1.3, _np.array(${py(xs)}), _np.array(${py(ys)})), check(-1.1, 0.9, _np.array(${py(xs)}), _np.array(${py(ys)}))]
[_fit_safe(max(e[0] for e in _e)), _fit_safe(max(e[1] for e in _e))]`,
      '`check()`',
    )
    if (r) setChecked(r)
  }

  const frac = (e: MouseEvent<Element>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { fx: (e.clientX - rect.left) / rect.width, fy: (e.clientY - rect.top) / rect.height }
  }

  const clickData = (e: MouseEvent<SVGSVGElement>) => {
    if (running) return
    const { fx, fy } = frac(e)
    const p = { x: round2(X[0] + fx * (X[1] - X[0])), y: round2(Y[1] - fy * (Y[1] - Y[0])) }
    const near = points.findIndex((q) => Math.abs(q.x - p.x) < 0.12 && Math.abs(q.y - p.y) < 0.24)
    if (near >= 0) setPoints(points.filter((_, i) => i !== near))
    else if (points.length < MAX_POINTS) setPoints([...points, p])
    setChecked(null)
  }

  const clickValley = (e: MouseEvent<SVGSVGElement>) => {
    if (running) return
    const { fx, fy } = frac(e)
    moveTo({ w: round2(W[0] + fx * (W[1] - W[0])), b: round2(B[1] - fy * (B[1] - B[0])) })
  }

  if (!has('predict')) return <Needs names={['predict()']} to="draw your line" />

  const [y0, y1, l] = view
  const sign = (v: number) => (v < 0 ? `−${Math.abs(v).toFixed(2)}` : v.toFixed(2))

  return (
    <div className="flex flex-col gap-3 @container">
      <div className="grid gap-3 @sm:grid-cols-2">
        <figure className="flex flex-col gap-1.5">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="ga-play-plot aspect-square w-full cursor-crosshair"
            onClick={clickData}
            role="img"
            aria-label={`${points.length} data points and your line. Click to add a point, or click a point to remove it.`}
          >
            <line x1={across(0, X)} x2={across(0, X)} y1={0} y2={100} className="ga-play-axis" />
            <line x1={0} x2={100} y1={down(0, Y)} y2={down(0, Y)} className="ga-play-axis" />
            {y0 !== null && y1 !== null && (
              <line x1={0} x2={100} y1={down(y0, Y)} y2={down(y1, Y)} className="ga-play-fit" />
            )}
            {points.map((p, i) => (
              <circle key={i} cx={across(p.x, X)} cy={down(p.y, Y)} r={1.6} className="ga-play-dot" />
            ))}
          </svg>
          <figcaption className="text-caption text-faint">Data · click to add or remove points</figcaption>
        </figure>

        <figure className="flex flex-col gap-1.5">
          {has('loss') ? (
            <div className="relative aspect-square">
              <canvas ref={canvas} className="ga-play-plot absolute inset-0 h-full w-full" />
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full cursor-crosshair"
                onClick={clickValley}
                role="img"
                aria-label={`The loss for every w and b. You're at w ${sign(wb.w)}, b ${sign(wb.b)}. Click to start somewhere else.`}
              >
                <polyline
                  points={path.map((p) => `${across(p.w, W)},${down(p.b, B)}`).join(' ')}
                  className="ga-play-path"
                />
                <circle cx={across(wb.w, W)} cy={down(wb.b, B)} r={2} className="ga-play-here" />
              </svg>
            </div>
          ) : (
            <div className="ga-play-empty flex aspect-square items-center justify-center">
              <Needs names={['loss()']} to="map the loss valley" />
            </div>
          )}
          <figcaption className="text-caption text-faint">
            Loss valley · w across, b up · click to start there
          </figcaption>
        </figure>
      </div>

      <p className="text-center text-caption text-faint tabular-nums">
        w {sign(wb.w)} · b {sign(wb.b)}
        {l !== null && ` · loss ${l.toPrecision(3)}`} · step {steps}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {running ? (
          <button type="button" className="ga-btn ga-btn--primary ga-btn--sm" onClick={() => (runRef.current = false)}>
            <Pause size={15} aria-hidden /> Pause
          </button>
        ) : (
          <button
            type="button"
            className="ga-btn ga-btn--primary ga-btn--sm"
            onClick={train}
            disabled={!has('step')}
            title={has('step') ? undefined : 'Write step() first'}
          >
            <Play size={15} aria-hidden /> Train
          </button>
        )}
        <button
          type="button"
          className="ga-btn ga-btn--secondary ga-btn--sm"
          disabled={running || !has('step')}
          onClick={() => void tick()}
        >
          <StepForward size={15} aria-hidden /> Step
        </button>
        <button
          type="button"
          className="ga-btn ga-btn--ghost ga-btn--sm"
          disabled={running}
          onClick={() => moveTo({ w: 0, b: 0 })}
        >
          <RotateCcw size={15} aria-hidden /> Reset
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <span className="mr-1 text-caption text-faint">Learning rate</span>
        {RATES.map((r) => (
          <button
            key={r}
            type="button"
            className="ga-play-chip tabular-nums"
            aria-pressed={lr === r}
            onClick={() => setLr(r)}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {Object.keys(PRESETS).map((name) => (
          <button
            key={name}
            type="button"
            className="ga-play-chip"
            disabled={running}
            onClick={() => {
              setPoints(PRESETS[name])
              setChecked(null)
            }}
          >
            {name}
          </button>
        ))}
        <button type="button" className="ga-play-chip" disabled={running} onClick={() => setPoints([])}>
          Clear
        </button>
        <button
          type="button"
          className="ga-play-chip"
          disabled={running || !has('check') || !points.length}
          onClick={check}
          title={has('check') ? 'Compare gradients() with nudges, at two ordinary points' : 'Write check() first'}
        >
          Check gradient
        </button>
      </div>

      {checked && <CheckResult errs={checked} />}
      {note && <p className="text-center text-small text-muted">{note}</p>}
    </div>
  )
}

function CheckResult({ errs }: { errs: [number | null, number | null] }) {
  const ok = errs.every((e) => e !== null && e < 1e-5)
  const show = (e: number | null) => (e === null ? '?' : e.toExponential(0))
  return (
    <p className="text-center text-small text-muted tabular-nums">
      Relative error: w {show(errs[0])}, b {show(errs[1])}.{' '}
      <span className={ok ? 'text-success' : 'text-danger'}>
        {ok ? 'Your gradient matches.' : "Your gradient doesn't match the nudges."}
      </span>
    </p>
  )
}
