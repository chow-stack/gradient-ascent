import { Dexie, type EntityTable } from 'dexie'
import type { CardType } from '../features/content/schema'
import type { ItemSource } from '../features/progress/xp'
import type { DayKey } from './dates'

/**
 * All progress lives in IndexedDB in this browser. Nothing leaves the machine.
 * Back it up from Settings (export JSON) — clearing site data wipes it.
 */

/** One graded try at an exercise. */
export type AttemptRow = {
  id?: number
  itemId: string
  lessonId: string
  type: CardType
  source: ItemSource
  at: number
  day: DayKey
  correct: boolean
  firstTry: boolean
  hintsUsed: number
  gaveUp: boolean
  durationMs: number
  xp: number
}

/** Spaced-repetition state for one exercise (FSRS card from ts-fsrs, stored as-is). */
export type ReviewRow = {
  itemId: string
  lessonId: string
  /** Epoch ms; indexed so "what's due" is a range query. */
  due: number
  card: unknown
}

export type MasteryStatus = 'passed' | 'mastered'

/** A lesson is `passed` when its ladder is done, `mastered` after a correct review on a later day. */
export type MasteryRow = { lessonId: string; status: MasteryStatus; passedOn: DayKey; masteredOn?: DayKey }

export type DayRow = { day: DayKey; xp: number; coreDone: boolean; items: number; ms: number }

/** How one Daily 5 problem went: right first try, right with help, or missed. */
export type DailyResult = 'clean' | 'assisted' | 'missed'

/** One day's fixed set of problems, and how each has gone so far. */
export type DailyRow = {
  day: DayKey
  itemIds: string[]
  results: Record<string, DailyResult>
  completedAt?: number
}

export class GradientDB extends Dexie {
  attempts!: EntityTable<AttemptRow, 'id'>
  reviews!: EntityTable<ReviewRow, 'itemId'>
  mastery!: EntityTable<MasteryRow, 'lessonId'>
  days!: EntityTable<DayRow, 'day'>
  dailies!: EntityTable<DailyRow, 'day'>

  constructor(name = 'gradient-ascent') {
    super(name)
    this.version(1).stores({
      attempts: '++id, itemId, lessonId, day',
      reviews: 'itemId, due, lessonId',
      mastery: 'lessonId',
      days: 'day',
    })
    this.version(2).stores({ dailies: 'day' })
  }
}

export const db = new GradientDB()

// ---------- Backup ----------

const TABLES = ['attempts', 'reviews', 'mastery', 'days', 'dailies'] as const
export type Backup = {
  app: 'gradient-ascent'
  version: 1
  exportedAt: string
  tables: Record<(typeof TABLES)[number], unknown[]>
}

export async function exportBackup(database: GradientDB = db): Promise<Backup> {
  const tables = {} as Backup['tables']
  for (const t of TABLES) tables[t] = await database.table(t).toArray()
  return { app: 'gradient-ascent', version: 1, exportedAt: new Date().toISOString(), tables }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

/** JSON turns Dates into strings; FSRS cards need them back as Dates. */
function reviveDates(value: unknown): unknown {
  if (typeof value === 'string' && ISO_DATE.test(value)) return new Date(value)
  if (Array.isArray(value)) return value.map(reviveDates)
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, reviveDates(v)]))
  return value
}

/** Replaces ALL progress with the backup's contents. */
export async function importBackup(raw: unknown, database: GradientDB = db): Promise<void> {
  const b = raw as Partial<Backup>
  if (!b || b.app !== 'gradient-ascent' || b.version !== 1 || !b.tables)
    throw new Error('This file is not a Gradient Ascent backup.')
  await database.transaction(
    'rw',
    TABLES.map((t) => database.table(t)),
    async () => {
      for (const t of TABLES) {
        // Backups from before the Daily 5 have no dailies table.
        const rows = t === 'dailies' ? (b.tables![t] ?? []) : b.tables![t]
        if (!Array.isArray(rows)) throw new Error(`Backup is missing "${t}".`)
        await database.table(t).clear()
        await database.table(t).bulkAdd(rows.map((r) => (t === 'reviews' ? reviveDates(r) : r)))
      }
    },
  )
}

export async function resetProgress(database: GradientDB = db): Promise<void> {
  await database.transaction(
    'rw',
    TABLES.map((t) => database.table(t)),
    async () => {
      for (const t of TABLES) await database.table(t).clear()
    },
  )
}
