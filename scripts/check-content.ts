/**
 * npm run content:check
 *
 * Validates every content file AND runs it in real Python (Pyodide in Node):
 * - predict questions: the answer must equal what the code actually prints
 * - parsons / blanks: the reference answer must pass
 * - fix-the-bug: the buggy code must FAIL and the solution must PASS
 * - write: the solution must pass and the starter must not
 * - worked examples and explain snippets must run without errors
 * - every card variant gets the same checks as its card
 *
 * Runs with Node's built-in TypeScript support (Node 23.6+), no build step.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadPyodide } from 'pyodide'
import {
  cardVariants,
  fillBlanks,
  milestoneOptions,
  parseLesson,
  parseTrack,
  runOptions,
  type Card,
  type Lesson,
} from '../src/features/content/schema.ts'
import {
  HARNESS_PY,
  normalizeOutput,
  runPassed,
  type RunOptions,
  type RunResult,
  type TestCase,
} from '../src/features/runner/harness.ts'
import { PLAY_SMOKE } from '../src/features/exercises/play/api.ts'

const root = join(import.meta.dirname, '..')
const problems: string[] = []
let checks = 0

const py = await loadPyodide({ packageBaseUrl: join(root, 'vendor/pyodide-packages') + '/' })
await py.loadPackage(['numpy', 'matplotlib'], { messageCallback: () => {} })
py.runPython(HARNESS_PY)
py.runPython('__ga_prepare_plots()')
// The browser stops a runaway loop by killing its worker. Here, a step limit does the same job.
// Python switches tracing off once the tracer raises. A profile hook turns it back on at the next call, so a later test
// that also never ends still hits the limit instead of hanging the check.
py.runPython(`
import sys
def __ga_run_limited(code, tests, opts):
    steps = [0]
    def tracer(frame, event, arg):
        if frame.f_code.co_filename != "main.py":
            return None
        if event == "line":
            steps[0] += 1
            if steps[0] > 200000:
                raise TimeoutError("ran too long")
        return tracer
    def rearm(frame, event, arg):
        if event == "call" and sys.gettrace() is None:
            sys.settrace(tracer)
            if frame.f_code.co_filename == "main.py":
                frame.f_trace = tracer
    sys.settrace(tracer)
    sys.setprofile(rearm)
    try:
        return __ga_run(code, tests, opts)
    finally:
        sys.setprofile(None)
        sys.settrace(None)
`)
const pyRun = py.globals.get('__ga_run_limited') as (code: string, tests: string, opts: string) => string
const run = (code: string, tests: TestCase[] = [], opts: RunOptions = {}): RunResult =>
  JSON.parse(pyRun(code, JSON.stringify(tests), JSON.stringify(opts)))
const trivial = py.globals.get('__ga_trivial') as (code: string) => boolean
const playLoad = py.globals.get('__ga_play_load') as (code: string, values: string) => string
const playCall = py.globals.get('__ga_play_call') as (src: string) => string
type Reply = { ok: boolean; value: unknown; error: { type: string; message: string } | null }

/** Loads a project's solution the way its Play panel does, and runs the game's contract check. */
function playSmoke(kind: keyof typeof PLAY_SMOKE, code: string): string | null {
  const { values, check } = PLAY_SMOKE[kind]
  const loaded = JSON.parse(playLoad(code, JSON.stringify(values ?? {}))) as Reply
  if (!loaded.ok) return `loading fails: ${loaded.error?.type}: ${loaded.error?.message}`
  const r = JSON.parse(playCall(check)) as Reply
  if (!r.ok) return `${r.error?.type}: ${r.error?.message}`
  return r.value === true ? null : `the check gave ${JSON.stringify(r.value)}`
}

/**
 * Answers that only hard-code what the checks look for: print the expected output, or define each tested
 * function to return the first expected value. If one passes, the card can't tell a real answer from a fake.
 */
type Checked = { solution: string; tests?: TestCase[]; expectOutput?: string }

function cheats(card: Checked): string[] {
  const imports = card.solution
    .split('\n')
    .filter((l) => /^(import|from) /.test(l))
    .join('\n')
  const out: string[] = []
  const printOut = card.expectOutput !== undefined ? `print(${JSON.stringify(normalizeOutput(card.expectOutput))})` : ''
  if (printOut && !card.tests?.length) out.push(`${imports}\n${printOut}`)
  if (card.tests?.length) {
    const values = card.tests
      .filter((t) => /^\s*[A-Za-z_]\w*\s*$/.test(t.call))
      .map((t) => `${t.call.trim()} = ${t.expect}`)
    if (values.length) out.push(`${imports}\n${values.join('\n')}\n${printOut}`)
    const firstExpect = new Map<string, string>()
    for (const t of card.tests) {
      const name = /^\s*([A-Za-z_]\w*)\s*\(/.exec(t.call)?.[1]
      if (name && !firstExpect.has(name)) firstExpect.set(name, t.expect)
    }
    if (firstExpect.size) {
      const defs = [...firstExpect].map(([n, e]) => `def ${n}(*a, **k):\n    return ${e}`).join('\n')
      out.push(`${imports}\n${defs}\n${printOut}`)
    }
  }
  return out
}

const describe = (r: RunResult) =>
  r.error
    ? `${r.error.type}: ${r.error.message} (line ${r.error.line})`
    : [
        ...r.tests
          .filter((t) => !t.passed)
          .map((t) => `${t.call} → ${t.got ?? t.error?.message} (expected ${t.expect})`),
        ...(r.rules ?? []).filter((x) => !x.passed).map((x) => `${x.kind} ${x.rule}`),
        ...(r.cases ?? [])
          .filter((c) => !c.passed)
          .map((c) =>
            c.missing
              ? `${c.set}: not set at the top`
              : c.error
                ? `${c.set}: ${c.error.type}: ${c.error.message}`
                : `${c.set}: printed ${JSON.stringify(c.got)}, solution ${JSON.stringify(c.expected)}`,
          ),
      ].join('; ') || `printed ${JSON.stringify(r.stdout)}`

function expect(ok: boolean, where: string, msg: string) {
  checks++
  if (!ok) problems.push(`${where}: ${msg}`)
}

for (const f of readdirSync(join(root, 'content/tracks')).filter((f) => f.endsWith('.yaml'))) {
  try {
    parseTrack(readFileSync(join(root, 'content/tracks', f), 'utf8'), f)
  } catch (e) {
    problems.push(String((e as Error).message))
  }
}

const lessons: Lesson[] = []
for (const f of readdirSync(join(root, 'content/lessons')).filter((f) => f.endsWith('.yaml'))) {
  try {
    lessons.push(parseLesson(readFileSync(join(root, 'content/lessons', f), 'utf8'), f))
  } catch (e) {
    problems.push(String((e as Error).message))
  }
}

// NumPy is self-hosted; make sure it works here and that tests can compare its values.
const numpyCheck = run('import numpy as np\nx = np.arange(6).reshape(2, 3)', [
  { call: 'x.sum(axis=0)', expect: '[3, 5, 7]' },
])
expect(runPassed(numpyCheck), 'numpy', `doesn't work: ${describe(numpyCheck)}`)
const plotCheck = run('import matplotlib.pyplot as plt\nplt.plot([1, 2])\nplt.show()', [])
expect(runPassed(plotCheck) && plotCheck.figures?.length === 1, 'plots', `don't work: ${describe(plotCheck)}`)

const traceCheck = run('def f():\n    return 1 / 0\nf()')
expect(
  traceCheck.error?.trace?.map((t) => t.where).join() === '<module>,f',
  'tracebacks',
  `wrong: ${describe(traceCheck)}`,
)
// A hard-coded answer must fail the reruns and the rules, and the real answer must pass them.
const extra: RunOptions = {
  solution: 'n = 1\nprint("small" if n < 5 else "big")',
  vary: [{ n: '9' }],
  requires: ['if'],
}
const fake = run('n = 1\nprint("small")', [], extra)
const real = run('n = 1\nif n < 5:\n    print("small")\nelse:\n    print("big")', [], extra)
expect(
  fake.cases?.[0]?.passed === false && fake.rules?.[0]?.passed === false && runPassed(real),
  'vary and rules',
  `don't work: ${describe(fake)} / ${describe(real)}`,
)
const loopCheck = run('while True:\n    pass')
expect(!runPassed(loopCheck), 'runaway loops', `not stopped: ${describe(loopCheck)}`)

const ids = new Set<string>()
const orders = new Set<string>()
for (const lesson of lessons) {
  if (ids.has(lesson.id)) problems.push(`Duplicate lesson id ${lesson.id}`)
  ids.add(lesson.id)
  const slot = `${lesson.track}/${lesson.unit}/${lesson.order}`
  if (orders.has(slot)) problems.push(`Two lessons share position ${slot}`)
  orders.add(slot)

  for (const card of lesson.cards) {
    checkCard(card, `${lesson.id}/${card.id}`)
    cardVariants(card).forEach((v, i) => checkCard(v, `${lesson.id}/${card.id} variant ${i + 1}`))
  }
}

function checkCheats(card: Checked, at: string, opts: RunOptions) {
  if (trivial(card.solution)) return // printing fixed text is the whole task
  for (const cheat of cheats(card)) {
    const r = run(cheat, card.tests, opts)
    expect(
      !runPassed(r, card.expectOutput),
      at,
      'hard-coding the answer passes. Add vary, more tests (hidden ones), or requires',
    )
  }
}

function checkCard(card: Card, at: string) {
  {
    switch (card.type) {
      case 'learn':
        if (card.code) {
          const r = run(card.code)
          if (card.expectError)
            expect(r.error?.type === card.expectError, at, `should end in ${card.expectError}: ${describe(r)}`)
          else expect(r.ok, at, `example crashes: ${describe(r)}`)
        }
        break
      case 'choice':
        if (card.kind === 'predict' && card.code) {
          const r = run(card.code)
          expect(
            normalizeOutput(r.stdout) === normalizeOutput(card.answer),
            at,
            `answer ${JSON.stringify(card.answer)} but the code prints ${JSON.stringify(r.stdout)}`,
          )
        }
        break
      case 'parsons': {
        const r = run(card.code, card.tests)
        expect(runPassed(r, card.expectOutput), at, `solution fails: ${describe(r)}`)
        break
      }
      case 'blank': {
        if (card.tests || card.expectOutput !== undefined) {
          // Every accepted answer must pass (first answer combined with each alternative).
          card.answers.forEach((options, slot) => {
            for (const option of options) {
              const values = card.answers.map((a, i) => (i === slot ? option : a[0]))
              const r = run(fillBlanks(card.code, values), card.tests)
              expect(runPassed(r, card.expectOutput), at, `answer "${option}" fails: ${describe(r)}`)
            }
          })
        }
        break
      }
      case 'fix': {
        const opts = runOptions(card)
        if (card.highlightLine)
          expect(
            card.highlightLine <= card.code.trimEnd().split('\n').length,
            at,
            `highlightLine ${card.highlightLine} is past the end of the code`,
          )
        const bad = run(card.code, card.tests, opts)
        expect(!runPassed(bad, card.expectOutput), at, 'the buggy code already passes')
        const good = run(card.solution, card.tests, opts)
        expect(runPassed(good, card.expectOutput), at, `solution fails: ${describe(good)}`)
        checkCheats(card, at, opts)
        break
      }
      case 'write': {
        const opts = runOptions(card)
        const good = run(card.solution, card.tests, opts)
        expect(runPassed(good, card.expectOutput), at, `solution fails: ${describe(good)}`)
        const starter = run(card.starter, card.tests, opts)
        expect(!runPassed(starter, card.expectOutput), at, 'the starter code already passes')
        checkCheats(card, at, opts)
        break
      }
      case 'project': {
        card.milestones.forEach((m, i) => {
          const where = `${at} milestone ${i + 1}`
          const opts = milestoneOptions(card.solution, m)
          const good = run(card.solution, m.tests, opts)
          expect(runPassed(good, m.expectOutput), where, `solution fails: ${describe(good)}`)
          checkCheats({ solution: card.solution, tests: m.tests, expectOutput: m.expectOutput }, where, opts)
        })
        const first = card.milestones[0]
        const starter = run(card.starter, first.tests, milestoneOptions(card.solution, first))
        expect(!runPassed(starter, first.expectOutput), at, 'the starter code already passes milestone 1')
        if (card.play) {
          const problem = playSmoke(card.play, card.solution)
          expect(problem === null, at, `the solution can't drive the ${card.play} game: ${problem}`)
          const starterLoad = JSON.parse(playLoad(card.starter, '{}')) as Reply
          expect(starterLoad.ok, at, `the starter crashes in the Play panel: ${starterLoad.error?.message}`)
        }
        break
      }
      case 'explain': {
        const r = run(card.code)
        if (card.expectError)
          expect(r.error?.type === card.expectError, at, `should end in ${card.expectError}: ${describe(r)}`)
        else expect(r.ok, at, `snippet crashes: ${describe(r)}`)
        break
      }
    }
  }
}

const cards = lessons.reduce((n, l) => n + l.cards.length, 0)
if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s):\n`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ ${lessons.length} lessons, ${cards} cards, ${checks} checks passed`)
