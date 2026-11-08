// @vitest-environment node
import { loadPyodide, type PyodideAPI } from 'pyodide'
import { beforeAll, describe, expect, it } from 'vitest'
import { HARNESS_PY, type PlayReply } from './harness'

/**
 * The Play panel's Python side: a program loaded once into a namespace that stays alive, then called into as the
 * player clicks. Runs the real harness in Pyodide, like content:check.
 */
let load: (code: string, values?: Record<string, string>) => PlayReply
let call: <T = unknown>(src: string) => PlayReply<T>

beforeAll(async () => {
  const py: PyodideAPI = await loadPyodide({
    packageBaseUrl: decodeURIComponent(new URL('../../../vendor/pyodide-packages/', import.meta.url).pathname),
  })
  await py.loadPackage(['numpy'], { messageCallback: () => {} })
  py.runPython(HARNESS_PY)
  const pyLoad = py.globals.get('__ga_play_load') as (code: string, values: string) => string
  const pyCall = py.globals.get('__ga_play_call') as (src: string) => string
  load = (code, values = {}) => JSON.parse(pyLoad(code, JSON.stringify(values)))
  call = (src) => JSON.parse(pyCall(src))
}, 120_000)

describe('loading a program', () => {
  it('runs it and keeps what it printed', () => {
    const r = load('x = 2\nprint("hi")')
    expect(r).toMatchObject({ ok: true, stdout: 'hi\n', error: null })
  })

  it('reports a crash with the line in the learner code', () => {
    const r = load('a = 1\nb = a + "x"')
    expect(r.ok).toBe(false)
    expect(r.error).toMatchObject({ type: 'TypeError', line: 2 })
  })

  it('reports a syntax error', () => {
    expect(load('def f(:\n  pass').error?.type).toBe('SyntaxError')
  })

  it('swaps in new values for variables set at the top', () => {
    load('player = "rock"\nscore = 0\nscore = score + 1', { player: '"paper"', score: '5' })
    expect(call('(player, score)').value).toEqual(['paper', 6])
  })

  it('says which variable to keep when one is missing', () => {
    const r = load('x = 1', { player: '"rock"' })
    expect(r.ok).toBe(false)
    expect(r.error?.message).toBe('Keep player = ... at the top of your code.')
  })

  it('replaces the previous program, and a failed load leaves nothing loaded', () => {
    load('a = 1')
    load('b = 2')
    expect(call('"a" in globals()').value).toBe(false)
    load('raise ValueError("no")')
    expect(call('1').error?.type).toBe('NotLoaded')
  })

  it("doesn't allow input()", () => {
    expect(load('name = input()').error?.message).toMatch(/input\(\) isn't available/)
  })
})

describe('calling into it', () => {
  it("gives back the last expression's value as JSON", () => {
    load('def double(x):\n    return x * 2')
    expect(call('double(21)').value).toBe(42)
    expect(call('{"a": [1, (2, 3)], "b": None, "c": True}').value).toEqual({ a: [1, [2, 3]], b: null, c: true })
  })

  it('keeps state between calls', () => {
    load('items = []')
    call('items.append(1)')
    call('items.append(2)')
    expect(call('items').value).toEqual([1, 2])
  })

  it('runs statements before the last expression', () => {
    load('total = 0')
    expect(call('for i in range(4):\n    total += i\ntotal').value).toBe(6)
  })

  it('captures what each call prints', () => {
    load('def hello():\n    print("hey")\n    return 1')
    expect(call('hello()')).toMatchObject({ ok: true, stdout: 'hey\n', value: 1 })
  })

  it('reports a crash inside the learner code with its line', () => {
    load('def f(word):\n    return word + 1')
    const r = call('f("a")')
    expect(r.ok).toBe(false)
    expect(r.value).toBeNull()
    expect(r.error).toMatchObject({ type: 'TypeError', line: 2 })
  })

  it('turns NumPy arrays and numbers into plain JSON', () => {
    load('import numpy as np\ng = np.array([[0, 1], [1, 0]])')
    expect(call('g').value).toEqual([
      [0, 1],
      [1, 0],
    ])
    expect(call('g.sum()').value).toBe(2)
    expect(call('np.float64(0.5)').value).toBe(0.5)
  })

  it('shows other objects by their repr, and sets as sorted lists', () => {
    load('class Card:\n    def __repr__(self):\n        return "A♠"')
    expect(call('[Card(), Card()]').value).toEqual(['A♠', 'A♠'])
    expect(call('{3, 1, 2}').value).toEqual([1, 2, 3])
  })

  it('lists which of the named functions and classes exist', () => {
    load('def score(g, a):\n    return ""\nclass Deck:\n    pass\npick = 3')
    expect(call('__ga_has("score", "Deck", "pick", "remaining")').value).toEqual(['score', 'Deck'])
  })
})
