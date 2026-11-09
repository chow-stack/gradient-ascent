import type { ExplainCheck } from '../ai/gemini'
import type { RunResult } from '../runner/harness'
import type { Answer, MilestoneResult } from './grading'

export type Phase = 'answering' | 'checking' | 'correct' | 'wrong' | 'revealed'

/** Where an explain card's AI check is up to. */
export type AiState =
  | { status: 'off' }
  | { status: 'checking' }
  | { status: 'done'; check: ExplainCheck }
  | { status: 'failed'; message: string }

export type ViewProps<C> = {
  card: C
  answer: Answer
  setAnswer: (a: Answer) => void
  phase: Phase
  result?: RunResult
  /** Projects: how each milestone went on the last check, and where to keep the draft. */
  milestones?: MilestoneResult[]
  draftKey?: string
  /** Explain cards: the AI's check, and whether the learner is grading themselves instead. */
  ai?: AiState
  selfGrading?: boolean
  onRetryAi?: () => void
  /** Shuffled choices and lines keep one order for this key, so coming back to a question doesn't reorder it. */
  orderKey?: string
  /** Check/continue. An editor passes its latest answer, which may be newer than `answer`. */
  onSubmit: (latest?: Answer) => void
}

/** Inputs are read-only unless the learner is answering. */
export const locked = (phase: Phase) => phase !== 'answering'
