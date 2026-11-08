import { Pause, Play, RotateCcw, Shuffle, StepForward } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { inline } from '../inline'
import { py, type PlayApi } from './api'
import { Needs } from './parts'
import { SPAM_PY } from './spamModel'

const RATES = [0.1, 0.5, 2]
const CHUNK = 5
const TICK_MS = 40
const MAX_STEPS = 2000
const SAMPLE = 'Congratulations, you won a free prize! Call now to claim it'

type Prepared = {
  n: number
  spam: number
  train: number
  val: number
  words: number
  leaked: number
  baseline: number | null
}
/** Training loss, training accuracy, validation loss, validation accuracy. */
type Report = [number | null, number | null, number | null, number | null]
type Point = { step: number; train: number | null; val: number | null }
type Scored = { p: number | null; pieces: [string, number | null][] }
type Metrics = {
  counts: [number, number, number, number]
  pr: [number | null, number | null] | null
  fooled: [string, number | null, number][]
  on: 'training' | 'validation'
}

const pct = (v: number | null) => (v === null ? '?' : `${Math.round(v * 100)}%`)
const num = (v: number | null) => (v === null ? '?' : v.toFixed(3))

/**
 * Unit 7: a spam filter whose every part is the learner's code. The app turns messages into word features from the
 * training part; sigmoid(), predict(), loss() and step() train it, split() and dedupe() keep validation honest, and
 * accuracy(), baseline() and precision_recall() judge it.
 */
export function Spam({ api }: { api: PlayApi }) {
  const { call, has } = api
  const [data, setData] = useState<Prepared | null>(null)
  const [seed, setSeed] = useState(0)
  const [lr, setLr] = useState(0.5)
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState(0)
  const [history, setHistory] = useState<Point[]>([])
  const [report, setReport] = useState<Report>([null, null, null, null])
  const [note, setNote] = useState('')
  const [text, setText] = useState(SAMPLE)
  const [scored, setScored] = useState<Scored | null>(null)
  const [threshold, setThreshold] = useState(0.5)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [round, setRound] = useState(0)
  const runRef = useRef(false)
  const stepsRef = useRef(0)
  const pyFlag = (b: boolean) => (b ? 'True' : 'False')
  const judges = () => `${pyFlag(has('loss'))}, ${pyFlag(has('accuracy'))}`

  const record = useCallback((at: number, r: Report) => {
    setReport(r)
    setHistory((h) => [...h, { step: at, train: r[0], val: r[2] }])
  }, [])

  // Load the helpers and prepare the data: once on mount, and again for a new split.
  useEffect(() => {
    void (async () => {
      if (!has('predict')) return
      if ((await call<boolean>(SPAM_PY, 'The Play panel')) !== true) return
      const d = await call<Prepared>(
        `_sp_prepare(${seed}, ${pyFlag(has('split'))}, ${pyFlag(has('dedupe'))}, ${pyFlag(has('baseline'))})`,
        has('dedupe') ? '`dedupe()` or `split()`' : '`split()`',
      )
      if (!d) return
      setData(d)
      stepsRef.current = 0
      setSteps(0)
      setHistory([])
      setNote('')
      const r = await call<Report>(`_sp_report(${judges()})`, '`predict()`, `loss()` or `accuracy()`')
      if (r) record(0, r)
    })()
    // `has` changes identity every render; what it answers only changes on Restart, which remounts this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, round, call, record])

  // Score the typed message and refresh the metrics whenever the weights or the inputs change.
  // Calls run one at a time in the worker, so replies arrive in order and the last one wins.
  useEffect(() => {
    if (!data) return
    void (async () => {
      const s = await call<Scored>(`_sp_score(${py(text)})`, '`predict()`')
      if (s) setScored(s)
    })()
  }, [data, text, steps, call])

  useEffect(() => {
    if (!data || !has('step')) return
    void (async () => {
      const m = await call<Metrics>(
        `_sp_metrics(${threshold}, ${pyFlag(has('precision_recall'))})`,
        '`precision_recall()`',
      )
      if (m) setMetrics(m)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, threshold, steps, call])

  const tick = async (n: number) => {
    const r = await call<Report | null>(`_sp_train(${n}, ${lr}, ${judges()})`, '`step()`')
    if (r === null) {
      setNote(`The weights blew up. Your step() may have the wrong sign, or try a smaller learning rate than ${lr}.`)
      return false
    }
    stepsRef.current += n
    setSteps(stepsRef.current)
    record(stepsRef.current, r)
    return true
  }

  const train = async () => {
    runRef.current = true
    setRunning(true)
    setNote('')
    while (runRef.current && stepsRef.current < MAX_STEPS) {
      const started = performance.now()
      if (!(await tick(CHUNK))) break
      await new Promise((r) => setTimeout(r, Math.max(0, TICK_MS - (performance.now() - started))))
    }
    if (stepsRef.current >= MAX_STEPS) setNote(`Stopped at ${MAX_STEPS} steps.`)
    runRef.current = false
    setRunning(false)
  }

  useEffect(
    () => () => {
      runRef.current = false
    },
    [],
  )

  if (!has('predict')) return <Needs names={['sigmoid()', 'predict()']} to="score messages" />
  if (!data) return <p className="ga-play-empty">Reading the messages…</p>

  const [, trainAcc, , valAcc] = report
  const shown = data.val ? valAcc : trainAcc
  const beat = shown !== null && data.baseline !== null ? Math.round((shown - data.baseline) * 100) : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-caption text-faint tabular-nums">
        <span>
          {data.n} messages, {data.spam} spam · {data.train} training · {data.val} validation · {data.words} words
        </span>
        <button
          type="button"
          className="ga-play-chip ml-auto"
          disabled={running || !has('split')}
          onClick={() => setSeed((s) => s + 1)}
          title={has('split') ? 'Shuffle a different split' : 'Write split() first'}
        >
          <Shuffle size={13} className="mr-1 inline" aria-hidden />
          New split
        </button>
      </div>

      {!has('split') && (
        <p className="text-small text-muted">
          {inline('Training on every message. Write `split()` to hold some back.')}
        </p>
      )}
      {has('split') && data.leaked > 0 && (
        <p className="ga-play-error">
          {inline(
            `${data.leaked} of the ${data.val} validation messages are copies of training ones, so the model has already seen them. Write \`dedupe()\` to remove copies before splitting.`,
          )}
        </p>
      )}

      <section className="flex flex-col gap-2">
        {has('loss') ? (
          <Curves history={history} hasVal={data.val > 0} />
        ) : (
          <Needs names={['loss()']} to="draw the learning curves" />
        )}
        <p className="text-center text-caption text-faint tabular-nums">
          step {steps}
          {report[0] !== null && ` · training loss ${num(report[0])}`}
          {report[2] !== null && ` · validation loss ${num(report[2])}`}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {running ? (
            <button
              type="button"
              className="ga-btn ga-btn--primary ga-btn--sm"
              onClick={() => (runRef.current = false)}
            >
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
            onClick={() => void tick(1)}
          >
            <StepForward size={15} aria-hidden /> Step
          </button>
          <button
            type="button"
            className="ga-btn ga-btn--ghost ga-btn--sm"
            disabled={running}
            onClick={() => setRound((r) => r + 1)}
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
        {note && <p className="text-center text-small text-muted">{note}</p>}
      </section>

      <section className="flex flex-col gap-1 text-center">
        {has('accuracy') ? (
          <p className="text-small tabular-nums">
            Accuracy on {data.val ? 'validation' : 'training'} <strong>{pct(shown)}</strong>
            {data.val > 0 && trainAcc !== null && <span className="text-faint"> · training {pct(trainAcc)}</span>}
            {data.baseline !== null && <span className="text-faint"> · baseline {pct(data.baseline)}</span>}
          </p>
        ) : (
          <p className="text-small text-muted">{inline('Write `accuracy()` to score it.')}</p>
        )}
        {beat !== null && steps > 0 && (
          <p className={`text-caption ${beat > 0 ? 'text-success' : 'text-danger'}`}>
            {beat > 0
              ? `${beat} points better than always saying "real"${data.leaked > 0 ? ', but validation has leaked' : ''}.`
              : 'No better than always saying "real".'}
          </p>
        )}
        {has('accuracy') && data.val > 0 && !has('baseline') && (
          <p className="text-caption text-faint">{inline('Write `baseline()` to see what doing nothing scores.')}</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <label className="text-caption text-faint" htmlFor="ga-spam-text">
          Try a message
        </label>
        <input
          id="ga-spam-text"
          className="ga-play-input w-full!"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
          spellCheck={false}
        />
        {scored && <Verdict scored={scored} threshold={threshold} />}
      </section>

      {has('step') && metrics && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <label className="text-caption text-faint" htmlFor="ga-spam-threshold">
              Threshold
            </label>
            <input
              id="ga-spam-threshold"
              type="range"
              min={0.05}
              max={0.95}
              step={0.05}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="flex-1 accent-(--color-accent)"
            />
            <span className="w-10 text-right text-small tabular-nums">{threshold.toFixed(2)}</span>
          </div>
          <p className="text-center text-small tabular-nums">
            {metrics.pr ? (
              <>
                Precision <strong>{pct(metrics.pr[0])}</strong> · recall <strong>{pct(metrics.pr[1])}</strong>
              </>
            ) : (
              <span className="text-muted">
                {inline('Write `precision_recall()` to measure the two kinds of mistake.')}
              </span>
            )}
          </p>
          <p className="text-center text-caption text-faint tabular-nums">
            On {metrics.on}: {metrics.counts[0]} spam caught · {metrics.counts[1]} real flagged · {metrics.counts[2]}{' '}
            spam missed · {metrics.counts[3]} real left alone
          </p>
          {metrics.fooled.length > 0 && steps > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-caption text-faint">Most confident mistakes</span>
              {metrics.fooled.map(([t, p, y], i) => (
                <p key={i} className="text-small">
                  <span className="text-muted">“{t}”</span>{' '}
                  <span className="text-faint tabular-nums">
                    {pct(p)} spam, really {y ? 'spam' : 'real'}
                  </span>
                </p>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

/** Training and validation loss against steps. */
function Curves({ history, hasVal }: { history: Point[]; hasVal: boolean }) {
  const last = history.length ? history[history.length - 1].step : 0
  const xMax = Math.max(100, last)
  const values = history.flatMap((p) => [p.train, p.val]).filter((v): v is number => v !== null)
  const yMax = Math.max(0.8, ...values.map((v) => Math.min(v, 5)))
  const line = (key: 'train' | 'val') =>
    history
      .filter((p) => p[key] !== null)
      .map((p) => `${(p.step / xMax) * 100},${100 - (Math.min(p[key]!, yMax) / yMax) * 100}`)
      .join(' ')
  return (
    <figure className="flex flex-col gap-1.5">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="ga-play-plot aspect-[5/2] max-h-44 w-full"
        role="img"
        aria-label="Training and validation loss at each step"
      >
        <polyline points={line('train')} className="ga-play-curve" />
        {hasVal && <polyline points={line('val')} className="ga-play-curve ga-play-curve--val" />}
      </svg>
      <figcaption className="flex justify-center gap-4 text-caption text-faint">
        <span>
          <span className="ga-play-key-swatch" aria-hidden /> training loss
        </span>
        {hasVal && (
          <span>
            <span className="ga-play-key-swatch ga-play-key-swatch--val" aria-hidden /> validation loss
          </span>
        )}
      </figcaption>
    </figure>
  )
}

/** The typed message's probability, with each word tinted by how hard it pushed. */
function Verdict({ scored, threshold }: { scored: Scored; threshold: number }) {
  const { p, pieces } = scored
  const spam = p !== null && p >= threshold
  const strongest = Math.max(1, ...pieces.map(([, w]) => Math.abs(w ?? 0)))
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className={`text-small font-semibold ${spam ? 'text-danger' : 'text-success'}`}>
          {p === null ? '?' : spam ? 'Spam' : 'Real'}
        </span>
        <div className="ga-play-meter flex-1" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={p ?? 0}>
          <div style={{ width: `${(p ?? 0) * 100}%` }} />
        </div>
        <span className="w-10 text-right text-small tabular-nums">{pct(p)}</span>
      </div>
      <p className="flex flex-wrap gap-1 text-small leading-relaxed">
        {pieces.map(([piece, w], i) => (
          <span
            key={i}
            className="ga-play-word"
            title={w === null ? 'Not a word it learned' : `Adds ${w.toFixed(2)} to the log-odds`}
            style={
              w === null
                ? { color: 'var(--color-faint)' }
                : {
                    background: `color-mix(in oklab, var(${w > 0 ? '--color-danger' : '--color-success'}) ${Math.round(
                      (Math.abs(w) / strongest) * 45,
                    )}%, transparent)`,
                  }
            }
          >
            {piece}
          </span>
        ))}
      </p>
    </div>
  )
}
