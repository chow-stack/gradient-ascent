import { fillBlanks, type Card } from '../content/schema'
import { runPassed, type RunResult } from '../runner/harness'
import { runPython } from '../runner/python'

/** What the learner has entered so far, per card type. */
export type Answer =
  | { type: 'learn' }
  | { type: 'choice'; choice: string | null }
  | { type: 'parsons'; lines: string[] }
  | { type: 'blank'; values: string[] }
  | { type: 'code'; code: string }
  | { type: 'explain'; text: string }

export type GradeResult = { correct: boolean; run?: RunResult; message?: string }

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
  if (expectOutput !== undefined) return 'It runs, but the printed output isn’t what was expected.'
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
    const run = await runPython(answer.code, card.tests)
    const correct = runPassed(run, expectOutput)
    return { correct, run, message: correct ? undefined : describeRun(run, expectOutput) }
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
      return { type: 'code', code: card.solution }
    default:
      return null
  }
}
