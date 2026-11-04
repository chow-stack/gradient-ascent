import { itemId, parseLesson, parseTrack, type Card, type Lesson, type Track } from './schema'

// Vite inlines every content file at build time; edits hot-reload in dev.
const lessonFiles = import.meta.glob('/content/lessons/*.yaml', { query: '?raw', import: 'default', eager: true })
const trackFiles = import.meta.glob('/content/tracks/*.yaml', { query: '?raw', import: 'default', eager: true })

export const tracks: Track[] = Object.entries(trackFiles).map(([f, src]) => parseTrack(src as string, f))

/** All lessons, in path order (track, unit, order). */
export const lessons: Lesson[] = Object.entries(lessonFiles)
  .map(([f, src]) => parseLesson(src as string, f))
  .sort((a, b) => a.track.localeCompare(b.track) || a.unit - b.unit || a.order - b.order)

const byId = new Map(lessons.map((l) => [l.id, l]))
const items = new Map<string, { lesson: Lesson; card: Card }>()
for (const lesson of lessons) for (const card of lesson.cards) items.set(itemId(lesson.id, card.id), { lesson, card })

export const getLesson = (id: string) => byId.get(id)
export const getItem = (id: string) => items.get(id)
export const lessonsForTrack = (track: string) => lessons.filter((l) => l.track === track)
