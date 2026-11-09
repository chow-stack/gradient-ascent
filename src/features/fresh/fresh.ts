import { useSyncExternalStore } from 'react'
import { addDays, dayKey, type DayKey } from '../../lib/dates'
import { db, type FreshTaskRow, type GradientDB } from '../../lib/db'
import { getGeminiKey } from '../ai/gemini'
import { pythonVocab, runPython } from '../runner/python'
import { writeTask, type TaskDeps } from './generate'
import { canWriteTasks, learnerKnowledge, type Knowledge } from './knowledge'
import { freshId, nextLevel, pickTopics } from './topics'

/**
 * The Daily 5's two coding tasks: written by the AI for each day, checked in real Python, and stored, so the set is
 * ready when the learner opens it. Without a key, offline, or before functions are taught, there are none and the
 * Daily 5 is all review cards, as before.
 */
export const TASK_SLOTS = 2

const browserDeps: TaskDeps = { run: (code, tests) => runPython(code, tests), vocab: (codes) => pythonVocab(codes) }

export async function freshTasksFor(day: DayKey, database: GradientDB = db): Promise<FreshTaskRow[]> {
  const rows = await database.fresh.where('day').equals(day).toArray()
  return rows.sort((a, b) => a.slot - b.slot)
}

// ---------- Progress while tasks are being written (for the loading screen) ----------

export type TaskStage = 'picking' | 'writing' | 'testing' | 'ready' | 'failed'
/** Each slot's stage while a day's tasks are written, and which try it's on. Null when nothing is being written. */
export type WritingState = { slots: { stage: TaskStage; attempt: number }[] } | null

let writing: WritingState = null
const listeners = new Set<() => void>()
const setWriting = (next: WritingState) => {
  writing = next
  listeners.forEach((l) => l())
}
const setSlot = (i: number, stage: TaskStage, attempt = 1) => {
  if (!writing) return
  setWriting({ slots: writing.slots.map((s, k) => (k === i ? { stage, attempt } : s)) })
}

export function useWritingTasks(): WritingState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => writing,
  )
}

// ---------- Preparing a day's tasks ----------

let knowledgeCache: { key: string; value: Promise<Knowledge> } | null = null
function knowledgeFor(mastery: Parameters<typeof learnerKnowledge>[0], deps: TaskDeps) {
  const key = [...mastery.keys()].sort().join(',')
  if (knowledgeCache?.key !== key) knowledgeCache = { key, value: learnerKnowledge(mastery, deps.vocab) }
  return knowledgeCache.value
}

const inFlight = new Map<DayKey, Promise<FreshTaskRow[]>>()
/** When writing a day's tasks last came up short, so a bad key or a busy AI isn't asked again on every visit. */
const shortAt = new Map<DayKey, number>()
const RETRY_AFTER_MS = 10 * 60_000

/** After a reset, a day's tasks may be written again straight away. */
export function allowRetry(day: DayKey) {
  shortAt.delete(day)
}

/**
 * Makes sure `day`'s tasks exist, writing any that are missing. Once that day's Daily 5 has been opened its set is
 * fixed, so nothing new is written for it. Never rejects: a task that can't be written just isn't there.
 */
export function prepareFreshTasks(
  now = new Date(),
  database: GradientDB = db,
  deps: TaskDeps = browserDeps,
  key = getGeminiKey(),
): Promise<FreshTaskRow[]> {
  const day = dayKey(now)
  const running = inFlight.get(day)
  if (running) return running
  if (Date.now() - (shortAt.get(day) ?? 0) < RETRY_AFTER_MS) return freshTasksFor(day, database)
  const job = prepare(day, now, database, deps, key)
    .catch((e) => {
      console.error(e)
      return freshTasksFor(day, database)
    })
    .finally(() => inFlight.delete(day))
  inFlight.set(day, job)
  return job
}

async function prepare(day: DayKey, now: Date, database: GradientDB, deps: TaskDeps, key: string) {
  const existing = await freshTasksFor(day, database)
  const open = [...Array(TASK_SLOTS).keys()].filter((s) => !existing.some((r) => r.slot === s))
  if (!open.length || !key || !navigator.onLine || (await database.dailies.get(day))) return existing

  const mastery = new Map((await database.mastery.toArray()).map((m) => [m.lessonId, m]))
  setWriting({ slots: open.map(() => ({ stage: 'picking', attempt: 1 })) })
  try {
    const knowledge = await knowledgeFor(mastery, deps)
    if (!canWriteTasks(knowledge)) return existing
    // Not the same lessons as the other task, or as yesterday's.
    const yesterday = await freshTasksFor(addDays(day, -1), database)
    const exclude = new Set([...existing, ...yesterday].map((r) => r.lessonId))
    const topics = await pickTopics(now, mastery, open.length, exclude, database)
    // Fewer topics than open slots: the rest won't be written.
    open.slice(topics.length).forEach((_, i) => setSlot(topics.length + i, 'failed'))
    const level = await nextLevel(database)
    const recent = (await database.fresh.toArray())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20)
      .map((r) => r.title)

    const written = await Promise.all(
      topics.map(async (focus, i) => {
        const slot = open[i]
        const id = freshId(day, slot)
        const task = await writeTask({ focus, knowledge, level, recent }, key, deps, id.replace(/:/g, '-'), (s, n) =>
          setSlot(i, s, n),
        )
        setSlot(i, task ? 'ready' : 'failed')
        if (!task) return null
        const row: FreshTaskRow = {
          id,
          day,
          slot,
          lessonId: focus.id,
          title: task.title,
          card: task.card,
          level,
          createdAt: Date.now(),
        }
        // The set may have been opened while this was being written; then it's too late for this one.
        if (await database.dailies.get(day)) return null
        await database.fresh.put(row)
        return row
      }),
    )
    if (written.some((r) => r === null) || topics.length < open.length) shortAt.set(day, Date.now())
    return [...existing, ...written.filter((r) => r !== null)].sort((a, b) => a.slot - b.slot)
  } finally {
    setWriting(null)
  }
}
