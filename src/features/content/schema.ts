import { parse } from 'yaml'
import { z } from 'zod'

/**
 * Curriculum content format. Lessons are YAML files in content/lessons/ (YAML because code blocks
 * stay readable with `|`). This file is the single source of truth for the shape; `npm run content:check`
 * validates every file and runs every solution in real Python.
 *
 * A lesson = one skill node on the path: short teaching cards mixed with activities, moving from reading code to
 * writing it. CURRICULUM.md §1 has the format.
 */

export const CHECKPOINT_MIN_CARDS = 8
/** Share of checkpoint cards that must be right (no hints, no "show answer") to pass. */
export const CHECKPOINT_PASS = 0.8

const id = z.string().regex(/^[a-z0-9-]+$/, 'ids are lowercase-kebab')
const hints = z.array(z.string()).default([])
const testCase = z.object({ call: z.string(), expect: z.string(), hidden: z.boolean().optional() })
const tests = z.array(testCase).optional()
/**
 * Other versions of a card: any fields here replace the card's own. Reviews cycle through them so an
 * answer can't just be remembered. Each one is validated, and checked in real Python by content:check.
 */
const variants = z.array(z.record(z.string(), z.unknown())).default([])

const learn = z.object({
  type: z.literal('learn'),
  id,
  /** The tag above the title, such as "The goal" or "Recap". */
  label: z.string().default('New idea'),
  title: z.string(),
  /** Short paragraphs. `inline code` is supported. About 100–150 words: what it does, why, and the mistake people make. */
  body: z.string(),
  /** Optional extra depth, collapsed until the learner opens it. */
  deeper: z.string().optional(),
  code: z.string().optional(),
  /** The error this example is meant to end with, such as NameError, for showing what errors look like. */
  expectError: z.string().optional(),
  /** Subgoal labels shown beside the code (worked-example principle). */
  subgoals: z.array(z.object({ line: z.number().int().positive(), label: z.string() })).default([]),
  /** If set, ask the learner to predict before they can run (PRIMM). */
  predict: z.string().optional(),
  /** An outside page to open (visuals are linked, not rebuilt). */
  link: z.object({ label: z.string(), url: z.url() }).optional(),
})

const choice = z.object({
  type: z.literal('choice'),
  id,
  /** predict = "what does this print?" (answer is checked against real output); concept = anything else. */
  kind: z.enum(['predict', 'concept']).default('concept'),
  prompt: z.string(),
  code: z.string().optional(),
  highlightLine: z.number().int().positive().optional(),
  choices: z.array(z.string()).min(2).max(4),
  answer: z.string(),
  why: z.string(),
  hints,
  variants,
})

const parsons = z.object({
  type: z.literal('parsons'),
  id,
  prompt: z.string(),
  /** The solution, one line per block, indentation included. Shuffled for the learner. */
  code: z.string(),
  distractors: z.array(z.string()).default([]),
  tests,
  expectOutput: z.string().optional(),
  why: z.string(),
  hints,
  variants,
})

const blank = z.object({
  type: z.literal('blank'),
  id,
  prompt: z.string(),
  /** Code with one or more `____` slots. */
  code: z.string(),
  /** Accepted answers per slot; the first is shown as the answer. */
  answers: z.array(z.array(z.string()).min(1)).min(1),
  tests,
  expectOutput: z.string().optional(),
  why: z.string(),
  hints,
  variants,
})

const fix = z.object({
  type: z.literal('fix'),
  id,
  prompt: z.string(),
  code: z.string(),
  solution: z.string(),
  highlightLine: z.number().int().positive().optional(),
  tests,
  expectOutput: z.string().optional(),
  why: z.string(),
  hints,
  variants,
})

const write = z.object({
  type: z.literal('write'),
  id,
  prompt: z.string(),
  starter: z.string(),
  solution: z.string(),
  tests,
  /** What the program should print, for programs too small to have anything else to test. */
  expectOutput: z.string().optional(),
  why: z.string().optional(),
  hints,
  variants,
})

const explain = z.object({
  type: z.literal('explain'),
  id,
  prompt: z.string(),
  code: z.string(),
  /** The error this snippet is meant to end with, when the question is about that error. */
  expectError: z.string().optional(),
  /** A good one-or-two sentence answer, shown after the learner writes theirs. */
  model: z.string(),
  keyPoints: z.array(z.string()).min(1),
})

export const cardSchema = z.discriminatedUnion('type', [learn, choice, parsons, blank, fix, write, explain])

function checkCard(c: z.infer<typeof cardSchema>, at: (msg: string) => void) {
  if (c.type === 'choice') {
    if (!c.choices.includes(c.answer)) at('answer must be one of the choices')
    if (new Set(c.choices).size !== c.choices.length) at('choices must be unique')
    if (c.kind === 'predict' && !c.code) at('predict questions need code')
  }
  if (c.type === 'blank') {
    const slots = c.code.split('____').length - 1
    if (slots !== c.answers.length) at(`has ${slots} blanks but ${c.answers.length} answer lists`)
  }
  if ((c.type === 'fix' || c.type === 'parsons' || c.type === 'write') && !c.tests && c.expectOutput === undefined)
    at('needs tests or expectOutput')
}

export const lessonSchema = z
  .object({
    id,
    track: z.enum(['ml']),
    unit: z.number().int().positive(),
    order: z.number().int().positive(),
    /**
     * A checkpoint ends a unit's lessons: a mixed quiz on the whole unit (CURRICULUM.md §1).
     * A project is a program built step by step; its cards stay out of spaced review.
     */
    kind: z.enum(['lesson', 'checkpoint', 'project']).default('lesson'),
    title: z.string(),
    summary: z.string(),
    cards: z.array(cardSchema).min(1),
  })
  .superRefine((lesson, ctx) => {
    const seen = new Set<string>()
    if (lesson.kind === 'checkpoint' && lesson.cards.length < CHECKPOINT_MIN_CARDS)
      ctx.addIssue({
        code: 'custom',
        message: `checkpoints need at least ${CHECKPOINT_MIN_CARDS} cards`,
        path: ['cards'],
      })
    lesson.cards.forEach((c, i) => {
      const at = (msg: string) => ctx.addIssue({ code: 'custom', message: `${c.id}: ${msg}`, path: ['cards', i] })
      if (seen.has(c.id)) at('duplicate card id')
      if (lesson.kind === 'checkpoint') {
        // Checkpoints measure what stuck: no teaching cards, no self-grading, no hints.
        if (c.type === 'learn' || c.type === 'explain') at(`${c.type} cards don't belong in a checkpoint`)
        if ('hints' in c && c.hints.length) at('checkpoint cards have no hints')
      }
      seen.add(c.id)
      checkCard(c, at)
      for (const v of cardVariants(c)) {
        const r = cardSchema.safeParse(v)
        if (!r.success) at(`variant: ${r.error.issues[0].path.join('.')}: ${r.error.issues[0].message}`)
        else checkCard(r.data, (msg) => at(`variant: ${msg}`))
      }
    })
  })

export type Card = z.infer<typeof cardSchema>
export type CardType = Card['type']
export type Lesson = z.infer<typeof lessonSchema>
export type TrackId = Lesson['track']

export const trackSchema = z.object({
  id: z.enum(['ml']),
  name: z.string(),
  summary: z.string(),
  units: z.array(z.object({ unit: z.number().int().positive(), title: z.string(), summary: z.string() })),
})
export type Track = z.infer<typeof trackSchema>

/** Parse + validate one lesson file. Throws with the file name and every problem listed. */
export function parseLesson(source: string, file: string): Lesson {
  return validate(lessonSchema, parse(source), file)
}

export function parseTrack(source: string, file: string): Track {
  return validate(trackSchema, parse(source), file)
}

function validate<T>(schema: z.ZodType<T>, data: unknown, file: string): T {
  const r = schema.safeParse(data)
  if (!r.success) {
    const lines = r.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    throw new Error(`Invalid content in ${file}:\n${lines.join('\n')}`)
  }
  return r.data
}

export const isCheckpoint = (lesson: Lesson) => lesson.kind === 'checkpoint'
export const isProject = (lesson: Lesson) => lesson.kind === 'project'

/** A card's alternate versions, as full cards. */
export function cardVariants(card: Card): Card[] {
  if (!('variants' in card)) return []
  return card.variants.map((v) => ({ ...card, ...v, variants: [] }) as Card)
}

/** The version to show on a card's nth review. The card itself came first, in its lesson. */
export function versionForReview(card: Card, reviewsSoFar: number): Card {
  const all = [card, ...cardVariants(card)]
  return all[(reviewsSoFar + 1) % all.length]
}

/** Exercise ids are global: "<lesson id>/<card id>". */
export const itemId = (lessonId: string, cardId: string) => `${lessonId}/${cardId}`

/** Card types that become spaced-repetition review items once seen. */
export const REVIEWABLE: ReadonlySet<CardType> = new Set(['choice', 'parsons', 'blank', 'fix', 'write'])

/** Replace each `____` slot in order. */
export function fillBlanks(code: string, values: string[]): string {
  let i = 0
  return code.replace(/____/g, () => values[i++] ?? '')
}
