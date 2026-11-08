import { useSyncExternalStore } from 'react'

/**
 * Debug mode, for building content: open any lesson at any card and jump between cards without answering.
 * Debug sessions never save attempts, XP, reviews or progress. Kept in this browser only.
 */
const KEY = 'ga.debug'
const listeners = new Set<() => void>()

export function isDebug(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setDebug(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    // Blocked storage just means no debug mode.
  }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useDebug(): boolean {
  return useSyncExternalStore(subscribe, isDebug, () => false)
}

/** The URL of a debug session for one lesson, starting at a card. */
export const debugSessionUrl = (lessonId: string, cardId?: string) =>
  `/session?kind=debug&lesson=${encodeURIComponent(lessonId)}${cardId ? `&card=${encodeURIComponent(cardId)}` : ''}`

/** Screens wide enough for the debug panel to sit beside the card instead of over it. */
export const WIDE = '(min-width: 1024px)'
const PANEL_KEY = 'ga.debug.panel'

/** Whether the debug panel starts open: as last left on a wide screen, and closed on a narrow one. */
export function debugPanelOpen(): boolean {
  try {
    if (!window.matchMedia(WIDE).matches) return false
    return localStorage.getItem(PANEL_KEY) !== '0'
  } catch {
    return true
  }
}

export function saveDebugPanelOpen(open: boolean) {
  try {
    localStorage.setItem(PANEL_KEY, open ? '1' : '0')
  } catch {
    // Not remembered; it opens next time.
  }
}
