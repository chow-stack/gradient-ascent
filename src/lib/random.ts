/** Fisher–Yates shuffle; returns a new array. */
export function shuffled<T>(xs: readonly T[], rand: () => number = Math.random): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const orders = new Map<string, number[]>()

/** Like `shuffled`, but the same key always gives the same order (for as long as the page is open). */
export function shuffledFor<T>(key: string, xs: readonly T[]): T[] {
  let order = orders.get(key)
  if (!order || order.length !== xs.length) {
    order = shuffled(xs.map((_, i) => i))
    orders.set(key, order)
  }
  return order.map((i) => xs[i])
}
