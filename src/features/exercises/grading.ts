import { fillBlanks, milestoneOptions, runOptions, type Card } from '../content/schema'
import { normalizeOutput, ruleLabel, runPassed, type RunResult } from '../runner/harness'
import { runPython } from '../runner/python'

/** What the learner has entered so far, per card type. */
export type Answer =
  | { type: 'learn' }
  | { type: 'choice'; choice: string | null }
  | { type: 'parsons'; lines: string[] }
  | { type: 'blank'; values: string[] }
  | { type: 'code'; code: string }
  | { type: 'explain'; text: string }

/** How one project milestone went. */
export type MilestoneResult = { passed: boolean; message?: string }

export type GradeResult = { correct: boolean; run?: RunResult; message?: string; milestones?: MilestoneResult[] }

/** Projects are longer programs, so they get longer to run. */
export const PROJECT_TIMEOUT_MS = 10_000

export function initialAnswer(card: Card): Answer {
  switch (card.type) {
    case 'learn':
      return { type: 'learn' }
    case 'choice':
      return { type: 'choice', choice: null }
    case 'parsons':
      return { type: 'parsons', lines: [] }
    case 'blank':
      return { type: 'blank', values: card.answers.map(() => '') }
    case 'fix':
      return { type: 'code', code: card.code }
    case 'write':
    case 'project':
      return { type: 'code', code: card.starter }
    case 'explain':
      return { type: 'explain', text: '' }
  }
}

export function canCheck(answer: Answer): boolean {
  switch (answer.type) {
    case 'learn':
      return true
    case 'choice':
      return answer.choice !== null
    case 'parsons':
      return answer.lines.length > 0
    case 'blank':
      return answer.values.every((v) => v.trim().length > 0)
    case 'code':
      return answer.code.trim().length > 0
    case 'explain':
      return answer.text.trim().length >= 10
  }
}

/** Card types whose checking runs real Python. */
export const needsPython = (card: Card) =>
  card.type === 'fix' ||
  card.type === 'write' ||
  card.type === 'project' ||
  card.type === 'learn' ||
  ((card.type === 'blank' || card.type === 'parsons') && (!!card.tests || card.expectOutput !== undefined))

const squash = (s: string) => s.replace(/\s+/g, '')
const sameLines = (a: string, b: string) =>
  a
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .trim() ===
  b
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .trim()

/** Summarize a failed run in one friendly sentence for the feedback bar. */
export function describeRun(r: RunResult, expectOutput?: string): string {
  if (r.timedOut) return 'The code ran too long. Is there a loop that never ends?'
  if (r.error) return `${r.error.type}${r.error.line ? ` on line ${r.error.line}` : ''}: ${r.error.message}`
  const failed = r.tests.filter((t) => !t.passed).length
  if (failed) return `${failed} of ${r.tests.length} tests failed. Check the results above.`
  if (expectOutput !== undefined && normalizeOutput(r.stdout) !== normalizeOutput(expectOutput))
    return 'It runs, but the printed output isn’t what was expected.'
  const rule = r.rules?.find((x) => !x.passed)
  if (rule)
    return rule.kind === 'requires'
      ? `It works, but this one is about ${ruleLabel(rule.rule)}. Use it in your answer.`
      : `It works, but try it without ${ruleLabel(rule.rule)}.`
  const c = r.cases?.find((x) => !x.passed)
  if (c) {
    if (c.missing) return `Keep the line that sets ${c.set.split(' = ')[0]}. The check changes it to try other values.`
    if (c.error) return `It works for the values given, but with ${c.set} it crashes: ${c.error.type}.`
    return `It works for the values given, but not with ${c.set}. Does it work out the answer, or just print it?`
  }
  return 'Not quite.'
}

/** Grade an answer. Explain cards are self-graded and never come here. */
export async function grade(card: Card, answer: Answer): Promise<GradeResult> {
  if (card.type === 'choice' && answer.type === 'choice') return { correct: answer.choice === card.answer }

  if (card.type === 'parsons' && answer.type === 'parsons') {
    const code = answer.lines.join('\n')
    if (card.tests || card.expectOutput !== undefined) {
      const run = await runPython(code, card.tests)
      const correct = runPassed(run, card.expectOutput)
      return { correct, run, message: correct ? undefined : describeRun(run, card.expectOutput) }
    }
    return { correct: sameLines(code, card.code) }
  }

  if (card.type === 'blank' && answer.type === 'blank') {
    const values = answer.values.map((v) => v.trim())
    if (card.tests || card.expectOutput !== undefined) {
      const run = await runPython(fillBlanks(card.code, values), card.tests)
      const correct = runPassed(run, card.expectOutput)
      return { correct, run, message: correct ? undefined : describeRun(run, card.expectOutput) }
    }
    return { correct: values.every((v, i) => card.answers[i].some((a) => squash(a) === squash(v))) }
  }

  if ((card.type === 'fix' || card.type === 'write') && answer.type === 'code') {
    const { expectOutput } = card
    const run = await runPython(answer.code, card.tests, runOptions(card))
    const correct = runPassed(run, expectOutput)
    return { correct, run, message: correct ? undefined : describeRun(run, expectOutput) }
  }

  if (card.type === 'project' && answer.type === 'code') {
    // Each milestone is checked on its own, so the checklist shows how far the program has got.
    const runs: RunResult[] = []
    const milestones: MilestoneResult[] = []
    for (const m of card.milestones) {
      const run = await runPython(answer.code, m.tests, milestoneOptions(card.solution, m), PROJECT_TIMEOUT_MS)
      const passed = runPassed(run, m.expectOutput)
      runs.push(run)
      milestones.push({ passed, message: passed ? undefined : describeRun(run, m.expectOutput) })
      if (run.timedOut) break // the rest would time out too
    }
    while (milestones.length < card.milestones.length) milestones.push({ passed: false })
    const first = milestones.findIndex((m) => !m.passed)
    if (first < 0) return { correct: true, run: runs[runs.length - 1], milestones }
    const done = milestones.filter((m) => m.passed).length
    return {
      correct: false,
      run: runs[Math.min(first, runs.length - 1)],
      milestones,
      message: `${done} of ${milestones.length} milestones done. Next: ${card.milestones[first].title}.`,
    }
  }

  throw new Error(`Can't grade a ${card.type} card with a ${answer.type} answer`)
}

/** The reference answer, for "Show answer". */
export function solutionFor(card: Card): Answer | null {
  switch (card.type) {
    case 'choice':
      return { type: 'choice', choice: card.answer }
    case 'parsons':
      return { type: 'parsons', lines: card.code.replace(/\n$/, '').split('\n') }
    case 'blank':
      return { type: 'blank', values: card.answers.map((a) => a[0]) }
    case 'fix':
    case 'write':
    case 'project':
      return { type: 'code', code: card.solution }
    default:
      return null
  }
}
