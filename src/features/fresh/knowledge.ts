import type { MasteryRow } from '../../lib/db'
import { lessons } from '../content/content'
import { cardVariants, fillBlanks, type Card, type Lesson } from '../content/schema'

/**
 * What the learner has been taught, read from the code in the lessons they've passed. A task's solution may only
 * use Python that appears there, so an AI-written task never needs something from a later lesson.
 */
export type Knowledge = {
  passed: Lesson[]
  /** Every vocab tag (see __ga_vocab) in the passed lessons' code. */
  allowed: Set<string>
}

/** Tags any task may use: the basics of every line of Python, all taught in the first lessons. */
const ALWAYS = new Set(
  [
    'Constant',
    'Name',
    'Expr',
    'Assign',
    'AugAssign',
    'Call',
    'keyword',
    'arguments',
    'arg',
    'Pass',
    'BinOp',
    'UnaryOp',
    'USub',
    'UAdd',
    'Add',
    'Sub',
    'Mult',
    'Div',
    'Compare',
    'Eq',
    'NotEq',
    'Lt',
    'LtE',
    'Gt',
    'GtE',
  ].map((n) => `node:${n}`),
)

/** Language features worth naming in the prompt, as [label, tags]. Any one tag present means it's taught. */
const FEATURES: [string, string[]][] = [
  ['functions with `def` and `return`', ['node:FunctionDef']],
  ['`if` / `elif` / `else`', ['node:If']],
  ['`and` / `or` / `not`', ['node:BoolOp', 'node:Not']],
  ['`while` loops', ['node:While']],
  ['`for` loops', ['node:For']],
  ['`break`', ['node:Break']],
  ['`continue`', ['node:Continue']],
  ['`%`, `//` and `**`', ['node:Mod', 'node:FloorDiv', 'node:Pow']],
  ['f-strings', ['node:JoinedStr']],
  ['indexing like `s[0]`', ['node:Subscript']],
  ['slices like `s[1:3]`', ['node:Slice']],
  ['`in` / `not in`', ['node:In', 'node:NotIn']],
  ['lists', ['node:List']],
  ['tuples', ['node:Tuple']],
  ['dictionaries', ['node:Dict']],
  ['sets', ['node:Set']],
  ['comprehensions', ['node:ListComp', 'node:DictComp', 'node:SetComp', 'node:GeneratorExp']],
  ['one-line `x if c else y`', ['node:IfExp']],
  ['`lambda`', ['node:Lambda']],
  ['`try` / `except`', ['node:Try']],
  ['`raise`', ['node:Raise']],
  ['classes', ['node:ClassDef']],
  ['imports', ['node:Import', 'node:ImportFrom']],
  ['`with`', ['node:With']],
  ['`global`', ['node:Global']],
  ['`is`', ['node:Is', 'node:IsNot']],
  ['unpacking with `*`', ['node:Starred']],
  ['`:=`', ['node:NamedExpr']],
]

/** Every piece of code in a card and its variants, with blanks filled in. */
export function cardCode(card: Card): string[] {
  // A project hands the learner code beyond what's been taught (input(), a list for random.choice in Unit 1), so
  // it says nothing about what they know.
  if (card.type === 'project') return []
  const out: string[] = []
  for (const c of [card, ...cardVariants(card)]) {
    if (c.type === 'blank')
      out.push(
        fillBlanks(
          c.code,
          c.answers.map((a) => a[0]),
        ),
      )
    else if ('code' in c && c.code) out.push(c.code)
    if ('solution' in c) out.push(c.solution)
  }
  return out
}

export function passedLessons(mastery: Map<string, MasteryRow>): Lesson[] {
  return lessons.filter((l) => mastery.has(l.id))
}

/** The allowed tags, from each passed lesson's code as `vocab` reads it. */
export async function learnerKnowledge(
  mastery: Map<string, MasteryRow>,
  vocab: (codes: string[]) => Promise<(string[] | null)[]>,
): Promise<Knowledge> {
  const passed = passedLessons(mastery)
  const codes = passed.flatMap((l) => l.cards.flatMap(cardCode))
  const allowed = new Set(ALWAYS)
  for (const tags of await vocab(codes)) for (const t of tags ?? []) allowed.add(t)
  return { passed, allowed }
}

/** Coding tasks need functions: a task is one function, checked by calling it. */
export const canWriteTasks = (k: Knowledge) => k.allowed.has('node:FunctionDef') && k.allowed.has('node:Return')

/** Tags used but not taught. */
export const untaught = (k: Knowledge, used: Iterable<string>) => [...new Set(used)].filter((t) => !k.allowed.has(t))

/** A readable name for a vocab tag, for the prompt and for telling the AI what went wrong. */
export function tagLabel(tag: string): string {
  const feature = FEATURES.find(([, tags]) => tags.includes(tag))
  if (feature) return feature[0]
  const [kind, name] = tag.split(':')
  if (kind === 'call') return `\`${name}()\``
  if (kind === 'method') return `\`.${name}()\``
  if (kind === 'import') return `\`import ${name}\``
  return `${name} syntax`
}

/** The learner's toolkit and what's off-limits, in words for the prompt. */
export function describeKnowledge(k: Knowledge) {
  const has = (tags: string[]) => tags.some((t) => k.allowed.has(t))
  const names = (kind: string) =>
    [...k.allowed]
      .filter((t) => t.startsWith(`${kind}:`))
      .map((t) => t.slice(kind.length + 1))
      .sort()
  return {
    features: FEATURES.filter(([, tags]) => has(tags)).map(([label]) => label),
    notYet: FEATURES.filter(([, tags]) => !has(tags)).map(([label]) => label),
    builtins: names('call'),
    methods: names('method'),
    imports: names('import'),
  }
}
