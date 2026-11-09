// @vitest-environment node
import { loadPyodide } from 'pyodide'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { lessons } from '../content/content'
import { HARNESS_PY, type RunResult } from '../runner/harness'
import { checkDraft, draftCard, parseDraft, userPrompt, writeTask, type TaskDeps, type TaskDraft } from './generate'
import { canWriteTasks, learnerKnowledge, type Knowledge } from './knowledge'

/** The task checks against real Python, with what a learner knows after Unit 1 and Unit 2's first six lessons. */
let deps: TaskDeps
let knows: Knowledge
const mastery = new Map(
  lessons
    .filter((l) => l.unit === 1 || (l.unit === 2 && l.order <= 6))
    .map((l) => [l.id, { lessonId: l.id, status: 'passed' as const, passedOn: '2026-11-01' }]),
)
const focus = lessons.find((l) => l.id === 'p2-accumulators') ?? lessons.find((l) => l.unit === 2 && l.order === 6)!

beforeAll(async () => {
  const py = await loadPyodide()
  py.runPython(HARNESS_PY)
  const run = py.globals.get('__ga_run') as (code: string, tests: string, opts: string) => string
  const vocab = py.globals.get('__ga_vocab') as (codes: string) => string
  deps = {
    run: async (code, tests) => JSON.parse(run(code, JSON.stringify(tests), '{}')) as RunResult,
    vocab: async (codes) => JSON.parse(vocab(JSON.stringify(codes))),
  }
  knows = await learnerKnowledge(mastery, deps.vocab)
}, 120_000)

afterEach(() => vi.unstubAllGlobals())

const good: TaskDraft = {
  plan: 'A while loop with an if inside, counting matches. Edge cases: no matches, and the limit itself.',
  title: 'Bus stop counter',
  description:
    'A bus stops at every stop whose number is a multiple of `step`. Write `count_stops(last, step)`, which gives back how many stops from 1 up to and including `last` the bus stops at. If `last` is 0, it gives back 0.',
  functionName: 'count_stops',
  parameters: ['last', 'step'],
  solution: `def count_stops(last, step):
    count = 0
    n = 1
    while n <= last:
        if n % step == 0:
            count += 1
        n += 1
    return count
`,
  tests: [
    { call: 'count_stops(10, 2)', expect: '5', hidden: false },
    { call: 'count_stops(10, 3)', expect: '3', hidden: false },
    { call: 'count_stops(7, 7)', expect: '1', hidden: false },
    { call: 'count_stops(0, 4)', expect: '0', hidden: true },
    { call: 'count_stops(6, 1)', expect: '6', hidden: true },
    { call: 'count_stops(9, 3)', expect: '3', hidden: true },
    { call: 'count_stops(5, 10)', expect: '0', hidden: true },
    { call: 'count_stops(20, 4)', expect: '5', hidden: true },
  ],
  hints: [
    'Count with a variable that starts at 0.',
    'Loop n from 1 to last, add 1 when n % step is 0, return the count.',
  ],
  why: 'A counter that only goes up when a condition holds.',
}

describe('what the learner knows', () => {
  it('comes from the passed lessons’ code', () => {
    expect(canWriteTasks(knows)).toBe(true)
    expect(knows.allowed.has('node:While')).toBe(true)
    expect(knows.allowed.has('node:List')).toBe(false) // lists are Unit 3
    expect(knows.allowed.has('node:For')).toBe(false) // for is Unit 2, lesson 8
  })

  it('is spelled out in the prompt, with what not to use', () => {
    const prompt = userPrompt({ focus, knowledge: knows, level: 'medium', recent: ['Pizza slices'] }, 'a bakery')
    expect(prompt).toContain(focus.title)
    expect(prompt).toMatch(/Not taught yet, so never use: .*lists/)
    expect(prompt).toMatch(/Language features: .*`while` loops/)
    expect(prompt).toContain('Setting: a bakery')
    expect(prompt).toContain('Pizza slices')
  })
})

describe('checking a task', () => {
  it('accepts a good one, and turns it into a write card', async () => {
    expect(await checkDraft(good, knows, deps)).toEqual([])
    const card = draftCard(good, 'fresh-2026-11-09-0')
    expect(card).toMatchObject({ type: 'write', starter: 'def count_stops(last, step):\n    # Your code here\n' })
    expect(card.type === 'write' && card.tests?.slice(0, 3).every((t) => !t.hidden)).toBe(true)
  })

  it('rejects tests that don’t match the solution, saying which', async () => {
    const draft = { ...good, tests: good.tests.map((t, i) => (i === 4 ? { ...t, expect: '5' } : t)) }
    const [problem] = await checkDraft(draft, knows, deps)
    expect(problem).toMatch(/count_stops\(6, 1\) returns 6, not 5/)
  })

  it('rejects Python that hasn’t been taught yet', async () => {
    const solution = `def count_stops(last, step):
    count = 0
    for n in range(1, last + 1):
        if n % step == 0:
            count += 1
    return count
`
    const [problem] = await checkDraft({ ...good, solution }, knows, deps)
    expect(problem).toMatch(/hasn't been taught: .*`for` loops/)
  })

  it('rejects a task that’s too easy, or one a constant answer passes', async () => {
    const easy = { ...good, solution: 'def count_stops(last, step):\n    return last // step\n' }
    expect((await checkDraft(easy, knows, deps)).join()).toMatch(/too easy/)
    const same = { ...good, tests: good.tests.map((t) => ({ ...t, expect: '3' })) }
    expect((await checkDraft(same, knows, deps)).join()).toMatch(/different expected values/)
  })

  it('reads the AI’s JSON defensively', () => {
    const d = parseDraft(JSON.stringify({ ...good, tests: [{ call: ' f(1) ', expect: 2 }], hints: 'x' }))
    expect(d.tests).toEqual([{ call: 'f(1)', expect: '', hidden: false }])
    expect(d.hints).toEqual([])
  })
})

describe('writing a task', () => {
  const reply = (draft: object) => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(draft) }] } }] }),
  })

  it('sends a rejected task back with the problem, and uses the fixed one', async () => {
    const wrong = { ...good, tests: good.tests.map((t, i) => (i === 0 ? { ...t, expect: '4' } : t)) }
    const fetch = vi.fn().mockResolvedValueOnce(reply(wrong)).mockResolvedValueOnce(reply(good))
    vi.stubGlobal('fetch', fetch)
    const task = await writeTask({ focus, knowledge: knows, level: 'medium', recent: [] }, 'key', deps, 'fresh-x-0')
    expect(task?.title).toBe('Bus stop counter')
    expect(fetch).toHaveBeenCalledTimes(2)
    const second = JSON.parse(fetch.mock.calls[1][1].body)
    expect(second.contents).toHaveLength(3)
    expect(second.contents[2].parts[0].text).toMatch(/count_stops\(10, 2\) returns 5, not 4/)
  })

  it('gives up after three bad tasks, or at once when the AI can’t be reached', async () => {
    const bad = vi.fn().mockResolvedValue(reply({ ...good, solution: 'def nope(:' }))
    vi.stubGlobal('fetch', bad)
    expect(await writeTask({ focus, knowledge: knows, level: 'medium', recent: [] }, 'k', deps, 'x')).toBeNull()
    expect(bad).toHaveBeenCalledTimes(3)

    const down = vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) })
    vi.stubGlobal('fetch', down)
    expect(await writeTask({ focus, knowledge: knows, level: 'medium', recent: [] }, 'k', deps, 'x')).toBeNull()
    expect(down).toHaveBeenCalledTimes(1)
  })
})
