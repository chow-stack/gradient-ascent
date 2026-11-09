import type { TaskLevel } from '../../lib/db'
import { generate as askGemini, GeminiError } from '../ai/gemini'
import { cardSchema, type Card, type Lesson } from '../content/schema'
import type { RunResult, TestCase } from '../runner/harness'
import { describeKnowledge, tagLabel, untaught, type Knowledge } from './knowledge'

/**
 * Writes one Daily 5 coding task with Gemini, then checks it in real Python before the learner sees it. A task
 * that fails a check goes back to the AI with the problem, a few times at most.
 */

export type TaskContext = {
  focus: Lesson
  knowledge: Knowledge
  level: TaskLevel
  /** Titles of recent tasks, so the situations don't repeat. */
  recent: string[]
}

/** What the AI sends back. `plan` is its own reasoning and is never shown. */
export type TaskDraft = {
  plan: string
  title: string
  description: string
  functionName: string
  parameters: string[]
  solution: string
  tests: TestCase[]
  hints: string[]
  why: string
}

export type TaskDeps = {
  /** Runs code against tests, like the editor's Check. */
  run: (code: string, tests: TestCase[]) => Promise<RunResult>
  /** The vocab tags each piece of code uses (see __ga_vocab). */
  vocab: (codes: string[]) => Promise<(string[] | null)[]>
}

const MAX_TRIES = 3
const TIMEOUT_MS = 60_000

const SETTINGS = [
  'a bakery',
  'a football match',
  'a video game',
  'a bike ride',
  'a school timetable',
  'a weather station',
  'a music playlist',
  'a library',
  'a garden',
  'a car park',
  'a chess club',
  'a space mission',
  'an animal shelter',
  'a cinema',
  'a train timetable',
  'a fitness tracker',
  'a chat app',
  'a recipe',
  'a board game',
  'a coffee shop',
  'an aquarium',
  'a step counter',
  'a hotel',
  'a password checker',
  'a bus route',
  'a quiz show',
  'a lemonade stand',
  'a bowling alley',
  'a thermostat',
  'a parcel delivery',
  'a marathon',
  'a pizza order',
  'a vending machine',
]

export const SYSTEM_PROMPT = `You write one Python practice task for a beginner's daily review. The learner reads your description, writes the function from scratch in an editor, and their code is graded by running your tests. They can't ask you questions, so the description must be complete on its own.

## Difficulty: medium
- Someone who knows the listed skills solves it in 5 to 10 minutes.
- The reference solution is one function with a body of about 5 to 12 lines.
- It needs at least two ideas working together, such as a loop with a condition inside, or a running total plus a check at the end. A task that needs one idea is too easy.
- It has exactly one detail worth thinking about: a boundary (is 10 included?), an empty or smallest input, or which value to start from. No tricks, no puzzles, no maths beyond arithmetic.
- Too easy: a lesson exercise with new names, or a body of one or two lines. Too hard: an algorithm nobody taught (sorting, searching a grid, recursion), loops nested more than two deep, or helper functions.

## The task
- A small, concrete everyday situation, described in 2 to 4 short sentences of plain English. Say what the function is given, what it gives back, and every rule the tests rely on, including what happens at the edge cases. Never explain how to solve it.
- Exactly one function with a short snake_case name and 1 to 3 parameters.
- The function returns its answer. It never prints and never calls input().
- Deterministic: no randomness, no dates or times, no files.
- The title is 2 to 5 words naming the situation, like "Bakery change counter". No code in the title.

## Only taught Python
The solution, every test call and every expected value may use only what's listed under "What the learner knows". Anything else counts as not taught, however common it is. When in doubt, write it the long way with the listed tools. This is checked automatically, and a task that breaks it is thrown away.

## Tests
- 3 visible tests: typical cases that make the rules clear. The learner sees these.
- 5 hidden tests: the edge cases the description mentions, plus a couple more typical values. A hidden test may only rely on rules stated in the description.
- "call" is a Python expression that calls the function, like count_votes("yynyy", "y"). "expect" is a Python literal (a number, a quoted string, True, False or None) equal to what the reference solution returns for that call. Work each one out carefully by tracing the solution; every test is run against it.
- At least 4 different expected values across the tests, so no constant answer can pass.

## Hints and why
- hints: exactly 2. The first names the approach in one sentence, without code. The second lays out the steps in order, close to the code but not code.
- why: one sentence naming the main idea the task practised.

## Style
Plain, friendly English for a beginner. Short sentences. Put code, names and values in \`backticks\`. No Markdown headings or bold.`

const LEVELS: Record<TaskLevel, string> = {
  easier:
    'Recent tasks were a struggle. Aim for the easy end of medium: one clear rule, one edge case, and a solution of about 5 to 7 lines.',
  medium: 'Aim for the middle of medium.',
  harder:
    'Recent tasks went smoothly. Aim for the hard end of medium: one more rule or edge case to handle, and a solution of about 9 to 12 lines. Still only taught Python.',
}

const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

/** The best example of the focus lesson's code exercises, for scale. */
function exampleCard(lesson: Lesson) {
  return (
    lesson.cards.find((c) => c.type === 'write' && c.tests?.length) ??
    lesson.cards.find((c) => c.type === 'write') ??
    lesson.cards.find((c) => c.type === 'fix')
  )
}

export function userPrompt(ctx: TaskContext, setting = pick(SETTINGS)): string {
  const { focus, knowledge } = ctx
  const k = describeKnowledge(knowledge)
  const goal = focus.cards.find((c) => c.type === 'learn' && c.points.length)
  const points = goal && goal.type === 'learn' ? goal.points.map((p) => `- ${p}`).join('\n') : ''
  const example = exampleCard(focus)
  const others = knowledge.passed.filter((l) => l.kind === 'lesson' && l.id !== focus.id)
  const list = (xs: string[]) => (xs.length ? xs.join(', ') : 'none')

  return `## Focus
Build the task around the lesson "${focus.title}" (Unit ${focus.unit}): ${focus.summary}
${points ? `It teaches:\n${points}\n` : ''}Combine it with one or two skills from the learner's earlier lessons.

## What the learner knows
Lessons passed:
${others.map((l) => `- ${l.title}: ${l.summary}`).join('\n')}
- ${focus.title}: ${focus.summary}

Language features: ${list(k.features)}
Built-in functions: ${list(k.builtins)}
Methods: ${list(k.methods.map((m) => `.${m}()`))}
Imports: ${list(k.imports)}
Not taught yet, so never use: ${list(k.notYet)}, and any built-in or method not listed above.
${
  example && (example.type === 'write' || example.type === 'fix')
    ? `
## For scale
An exercise from the focus lesson. Yours should be a step bigger than this, and about a different situation:
${example.prompt}
\`\`\`python
${example.solution.trimEnd()}
\`\`\`
`
    : ''
}
## This task
Setting: ${setting}, or something close to it if that fits the skill badly.
${LEVELS[ctx.level]}${ctx.recent.length ? `\nDon't repeat these recent tasks: ${ctx.recent.join('; ')}.` : ''}`
}

export const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    plan: {
      type: 'string',
      description:
        'Two or three sentences, not shown to the learner: the skills combined, why it is medium, and the edge cases the hidden tests cover.',
    },
    title: { type: 'string' },
    description: { type: 'string' },
    functionName: { type: 'string' },
    parameters: { type: 'array', items: { type: 'string' } },
    solution: { type: 'string', description: 'The reference solution: only the one function, no calls or prints.' },
    tests: {
      type: 'array',
      items: {
        type: 'object',
        properties: { call: { type: 'string' }, expect: { type: 'string' }, hidden: { type: 'boolean' } },
        required: ['call', 'expect', 'hidden'],
      },
    },
    hints: { type: 'array', items: { type: 'string' } },
    why: { type: 'string' },
  },
  required: ['plan', 'title', 'description', 'functionName', 'parameters', 'solution', 'tests', 'hints', 'why'],
}

/** A task that can't be used, with what to tell the AI. */
export class TaskProblem extends Error {}

const IDENT = /^[a-z_][a-z0-9_]*$/
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export function parseDraft(raw: string): TaskDraft {
  let d: Record<string, unknown>
  try {
    d = JSON.parse(raw)
  } catch {
    throw new TaskProblem('The reply wasn’t valid JSON.')
  }
  const tests = Array.isArray(d.tests)
    ? (d.tests as Record<string, unknown>[]).map((t) => ({
        call: str(t.call),
        expect: str(t.expect),
        hidden: t.hidden === true,
      }))
    : []
  return {
    plan: str(d.plan),
    title: str(d.title),
    description: str(d.description),
    functionName: str(d.functionName),
    parameters: Array.isArray(d.parameters) ? d.parameters.map(str) : [],
    solution: typeof d.solution === 'string' ? d.solution.replace(/\s+$/, '') + '\n' : '',
    tests,
    hints: Array.isArray(d.hints) ? d.hints.map(str).filter(Boolean) : [],
    why: str(d.why),
  }
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length

/** Lines of the function's body that do something. */
function bodyLines(solution: string): number {
  return solution
    .split('\n')
    .slice(1)
    .filter((l) => l.trim() && !l.trim().startsWith('#')).length
}

/** Everything wrong with a draft, as sentences for the AI. Empty means it's ready. */
export async function checkDraft(d: TaskDraft, k: Knowledge, deps: TaskDeps): Promise<string[]> {
  const problems: string[] = []
  const name = d.functionName
  if (!IDENT.test(name)) problems.push('functionName must be a snake_case Python name.')
  if (d.parameters.length < 1 || d.parameters.length > 3 || !d.parameters.every((p) => IDENT.test(p)))
    problems.push('Give the function 1 to 3 parameters with snake_case names.')
  if (problems.length) return problems
  if (!d.title || d.title.length > 40 || d.title.includes('`')) problems.push('The title must be 2 to 5 plain words.')
  if (words(d.description) < 15 || words(d.description) > 110)
    problems.push('The description must be 2 to 4 short sentences.')
  if (d.hints.length !== 2) problems.push('Give exactly 2 hints.')
  if (!d.why) problems.push('Fill in why.')

  const header = new RegExp(`^def ${name}\\(\\s*${d.parameters.join('\\s*,\\s*')}\\s*\\):`)
  if (!header.test(d.solution)) problems.push(`The solution must start with def ${name}(${d.parameters.join(', ')}):`)
  if (/^\S/m.test(d.solution.split('\n').slice(1).join('\n')))
    problems.push('The solution must be only the one function, with nothing after it.')
  const lines = bodyLines(d.solution)
  if (lines < 4) problems.push(`The solution body has ${lines} lines, which is too easy. Make the task need more.`)
  if (lines > 15) problems.push(`The solution body has ${lines} lines, which is too long for medium.`)
  if (/\b(print|input)\(/.test(d.solution)) problems.push('The function must return its answer, not print or ask.')

  const visible = d.tests.filter((t) => !t.hidden).length
  const hidden = d.tests.length - visible
  if (visible < 2 || visible > 4 || hidden < 3 || hidden > 8) problems.push('Give 3 visible tests and 5 hidden ones.')
  if (d.tests.some((t) => !t.call.startsWith(`${name}(`)))
    problems.push(`Every test call must be a call to ${name}(...).`)
  if (new Set(d.tests.map((t) => t.expect.replace(/\s+/g, ''))).size < 4)
    problems.push('Use at least 4 different expected values, so a constant answer can’t pass.')
  if (problems.length) return problems

  const codes = [d.solution, ...d.tests.map((t) => t.call), ...d.tests.map((t) => t.expect)]
  const tags = await deps.vocab(codes)
  if (tags[0] === null) return ['The solution has a syntax error.']
  const bad = tags.findIndex((t, i) => i > 0 && t === null)
  if (bad > 0) return [`This isn't valid Python: ${codes[bad]}`]
  const extra = untaught(
    k,
    tags.flatMap((t) => t ?? []),
  )
  if (extra.length)
    return [
      `It uses Python the learner hasn't been taught: ${[...new Set(extra.map(tagLabel))].join(', ')}. Use only what's listed, or change the task.`,
    ]

  const run = await deps.run(d.solution, d.tests)
  if (run.timedOut) return ['The reference solution never finishes on one of the tests.']
  if (run.error) return [`The reference solution crashes: ${run.error.type}: ${run.error.message}`]
  const wrong = run.tests.filter((t) => !t.passed)
  if (wrong.length)
    return [
      `These tests don't match what the reference solution returns: ${wrong
        .map((t) => (t.error ? `${t.call} raises ${t.error.type}` : `${t.call} returns ${t.got}, not ${t.expect}`))
        .join('; ')}. Decide which is right for the description, and fix the test or the solution.`,
    ]
  return []
}

/** A checked draft as a write card, graded like any other. */
export function draftCard(d: TaskDraft, id: string): Card {
  return cardSchema.parse({
    type: 'write',
    id,
    prompt: d.description,
    starter: `def ${d.functionName}(${d.parameters.join(', ')}):\n    # Your code here\n`,
    solution: d.solution,
    // Visible examples first, in the order given.
    tests: [...d.tests.filter((t) => !t.hidden), ...d.tests.filter((t) => t.hidden)].map((t) =>
      t.hidden ? t : { call: t.call, expect: t.expect },
    ),
    why: d.why,
    hints: d.hints,
  })
}

/** Writes and checks a task, sending problems back to the AI. Null if no usable task came back in time. */
export async function writeTask(
  ctx: TaskContext,
  key: string,
  deps: TaskDeps,
  id: string,
  /** Told when each try starts asking the AI, and when its draft goes to Python. */
  onStage?: (stage: 'writing' | 'testing', attempt: number) => void,
): Promise<{ title: string; card: Card } | null> {
  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [
    { role: 'user', parts: [{ text: userPrompt(ctx) }] },
  ]
  for (let i = 0; i < MAX_TRIES; i++) {
    let raw: string
    onStage?.('writing', i + 1)
    try {
      raw = await askGemini(
        key,
        {
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: { responseMimeType: 'application/json', responseJsonSchema: RESPONSE_SCHEMA },
        },
        TIMEOUT_MS,
      )
    } catch (e) {
      // Out of quota or offline: another try won't help.
      if (e instanceof GeminiError) console.warn('Coding task:', e.message)
      return null
    }
    let problems: string[]
    let draft: TaskDraft | null = null
    try {
      draft = parseDraft(raw)
      onStage?.('testing', i + 1)
      problems = await checkDraft(draft, ctx.knowledge, deps)
    } catch (e) {
      problems = [e instanceof TaskProblem ? e.message : 'The task couldn’t be read.']
    }
    if (draft && !problems.length) return { title: draft.title, card: draftCard(draft, id) }
    console.warn('Coding task rejected:', problems)
    contents.push(
      { role: 'model', parts: [{ text: raw }] },
      {
        role: 'user',
        parts: [{ text: `That task can't be used:\n- ${problems.join('\n- ')}\nSend the whole task again, fixed.` }],
      },
    )
  }
  return null
}
