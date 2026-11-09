// @vitest-environment node
import { loadPyodide } from 'pyodide'
import { beforeAll, describe, expect, it } from 'vitest'
import { HARNESS_PY, type RunResult, type TestCase } from './harness'

/**
 * Code that runs in the harness (the learner's, and the AI's) can't import the modules that reach the browser.
 * The worker's lockDown() and CSP are the real wall; this checks the Python-side courtesy in front of them.
 */
let run: (code: string, tests?: TestCase[]) => RunResult

beforeAll(async () => {
  const py = await loadPyodide({
    packageBaseUrl: decodeURIComponent(new URL('../../../vendor/pyodide-packages/', import.meta.url).pathname),
  })
  await py.loadPackage(['numpy'], { messageCallback: () => {} })
  py.runPython(HARNESS_PY)
  const pyRun = py.globals.get('__ga_run') as (code: string, tests: string, opts: string) => string
  run = (code, tests = []) => JSON.parse(pyRun(code, JSON.stringify(tests), '{}'))
}, 120_000)

describe('the harness sandbox', () => {
  it.each(['import js', 'import pyodide_js', 'from pyodide.ffi import to_js', 'import micropip'])(
    'refuses %s',
    (code) => {
      const r = run(code)
      expect(r.ok).toBe(false)
      expect(r.error).toMatchObject({ type: 'ImportError', message: expect.stringContaining("isn't available here") })
    },
  )

  it('refuses it inside a function, a test call and an expected value', () => {
    const r = run('def f():\n    import js\n    return 1', [
      { call: 'f()', expect: '1' },
      { call: '__import__("js")', expect: 'None' },
      { call: '1', expect: '__import__("js")' },
    ])
    expect(r.tests.map((t) => t.passed)).toEqual([false, false, false])
  })

  it('still allows ordinary imports', () => {
    const r = run(
      'import math\nimport numpy as np\nfrom collections import Counter\nprint(math.floor(np.mean([1, 2])))',
    )
    expect(r).toMatchObject({ ok: true, stdout: '1\n' })
  })

  it('keeps input() disabled', () => {
    expect(run('input()').error?.message).toContain('input()')
  })
})
