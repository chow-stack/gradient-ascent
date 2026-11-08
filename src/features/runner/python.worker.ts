/// <reference lib="webworker" />
import type { PyodideAPI } from 'pyodide'
import { HARNESS_PY, type RunOptions, type TestCase } from './harness'

type RunRequest = { id: number; code: string; tests: TestCase[]; opts?: RunOptions }

let pyodide: Promise<PyodideAPI> | null = null

async function boot(): Promise<PyodideAPI> {
  // Served by the pyodide Vite plugin (vite.config.ts); not bundled.
  const url = '/pyodide/pyodide.mjs'
  const { loadPyodide } = (await import(/* @vite-ignore */ url)) as typeof import('pyodide')
  const py = await loadPyodide({ indexURL: '/pyodide/' })
  py.runPython(HARNESS_PY)
  return py
}

pyodide = boot()
pyodide.then(
  () => self.postMessage({ type: 'ready' }),
  (e: unknown) => self.postMessage({ type: 'boot-error', message: String(e) }),
)

self.onmessage = async (e: MessageEvent<RunRequest>) => {
  const { id, code, tests, opts } = e.data
  try {
    const py = await pyodide!
    // Packages load on first import (NumPy takes a moment), before the run's time limit starts.
    const all = code + '\n' + (opts?.solution ?? '')
    await py.loadPackagesFromImports(all, { messageCallback: () => {} })
    if (all.includes('matplotlib')) (py.globals.get('__ga_prepare_plots') as () => void)()
    self.postMessage({ type: 'started', id })
    const run = py.globals.get('__ga_run') as (code: string, tests: string, opts: string) => string
    const json = run(code, JSON.stringify(tests), JSON.stringify(opts ?? {}))
    self.postMessage({ type: 'result', id, result: JSON.parse(json) })
  } catch (err) {
    self.postMessage({ type: 'result', id, result: internalError(err) })
  }
}

function internalError(err: unknown) {
  return { ok: false, stdout: '', tests: [], error: { type: 'InternalError', message: String(err), line: null } }
}
