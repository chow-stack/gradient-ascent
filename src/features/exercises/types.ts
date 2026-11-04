import type { RunResult } from '../runner/harness'
import type { Answer } from './grading'

export type Phase = 'answering' | 'checking' | 'correct' | 'wrong' | 'revealed'

export type ViewProps<C> = {
  card: C
  answer: Answer
  setAnswer: (a: Answer) => void
  phase: Phase
  result?: RunResult
  /** Check/continue. An editor passes its latest answer, which may be newer than `answer`. */
  onSubmit: (latest?: Answer) => void
}

/** Inputs are read-only unless the learner is answering. */
export const locked = (phase: Phase) => phase !== 'answering'
