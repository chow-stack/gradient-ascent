/** Fisher–Yates shuffle; returns a new array. */
export function shuffled<T>(xs: readonly T[], rand: () => number = Math.random): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
