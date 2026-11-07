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
  parseLesson,
  parseTrack,
  type Card,
  type Lesson,
} from '../src/features/content/schema.ts'
import {
  HARNESS_PY,
  normalizeOutput,
  runPassed,
  type RunResult,
  type TestCase,
} from '../src/features/runner/harness.ts'

const root = join(import.meta.dirname, '..')
const problems: string[] = []
let checks = 0

const py = await loadPyodide({ packageBaseUrl: join(root, 'vendor/pyodide-packages') + '/' })
await py.loadPackage(['numpy', 'matplotlib'], { messageCallback: () => {} })
py.runPython(HARNESS_PY)
py.runPython('__ga_prepare_plots()')
// The browser stops a runaway loop by killing its worker. Here, a step limit does the same job.
py.runPython(`
import sys
def __ga_run_limited(code, tests):
    steps = [0]
    def tracer(frame, event, arg):
        if frame.f_code.co_filename != "main.py":
            return None
        if event == "line":
            steps[0] += 1
            if steps[0] > 200000:
                raise TimeoutError("ran too long")
        return tracer
    sys.settrace(tracer)
    try:
        return __ga_run(code, tests)
    finally:
        sys.settrace(None)
`)
const pyRun = py.globals.get('__ga_run_limited') as (code: string, tests: string) => string
const run = (code: string, tests: TestCase[] = []): RunResult => JSON.parse(pyRun(code, JSON.stringify(tests)))

const describe = (r: RunResult) =>
  r.error
    ? `${r.error.type}: ${r.error.message} (line ${r.error.line})`
    : r.tests
        .filter((t) => !t.passed)
        .map((t) => `${t.call} → ${t.got ?? t.error?.message} (expected ${t.expect})`)
        .join('; ') || `printed ${JSON.stringify(r.stdout)}`

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
        if (card.highlightLine)
          expect(
            card.highlightLine <= card.code.trimEnd().split('\n').length,
            at,
            `highlightLine ${card.highlightLine} is past the end of the code`,
          )
        const bad = run(card.code, card.tests)
        expect(!runPassed(bad, card.expectOutput), at, 'the buggy code already passes')
        const good = run(card.solution, card.tests)
        expect(runPassed(good, card.expectOutput), at, `solution fails: ${describe(good)}`)
        break
      }
      case 'write': {
        const good = run(card.solution, card.tests)
        expect(runPassed(good, card.expectOutput), at, `solution fails: ${describe(good)}`)
        const starter = run(card.starter, card.tests)
        expect(!runPassed(starter, card.expectOutput), at, 'the starter code already passes')
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
