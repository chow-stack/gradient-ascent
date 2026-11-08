/** Project code, kept in this browser as the learner types so they can leave and come back. */
const PREFIX = 'ga.draft.'

export function loadDraft(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

export function saveDraft(key: string, code: string) {
  try {
    localStorage.setItem(PREFIX + key, code)
  } catch {
    // Storage can be full or blocked; the draft just isn't kept.
  }
}
