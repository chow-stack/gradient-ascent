/// <reference lib="webworker" />
import type { PyodideAPI } from 'pyodide'
import { HARNESS_PY, type RunOptions, type TestCase } from './harness'

type RunRequest =
  | { id: number; kind?: 'run'; code: string; tests: TestCase[]; opts?: RunOptions }
  | { id: number; kind: 'play-load'; code: string; values?: Record<string, string> }
  | { id: number; kind: 'play-call'; src: string }

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
  const req = e.data
  const { id } = req
  try {
    const py = await pyodide!
    if (req.kind === 'play-call') {
      self.postMessage({ type: 'started', id })
      const call = py.globals.get('__ga_play_call') as (src: string) => string
      self.postMessage({ type: 'result', id, result: JSON.parse(call(req.src)) })
      return
    }
    // Packages load on first import (NumPy takes a moment), before the run's time limit starts.
    const all = req.code + '\n' + (req.kind === 'play-load' ? '' : (req.opts?.solution ?? ''))
    await py.loadPackagesFromImports(all, { messageCallback: () => {} })
    if (all.includes('matplotlib')) (py.globals.get('__ga_prepare_plots') as () => void)()
    self.postMessage({ type: 'started', id })
    if (req.kind === 'play-load') {
      const load = py.globals.get('__ga_play_load') as (code: string, values: string) => string
      self.postMessage({ type: 'result', id, result: JSON.parse(load(req.code, JSON.stringify(req.values ?? {}))) })
      return
    }
    const run = py.globals.get('__ga_run') as (code: string, tests: string, opts: string) => string
    const json = run(req.code, JSON.stringify(req.tests), JSON.stringify(req.opts ?? {}))
    self.postMessage({ type: 'result', id, result: JSON.parse(json) })
  } catch (err) {
    self.postMessage({ type: 'result', id, result: internalError(err) })
  }
}

function internalError(err: unknown) {
  return {
    ok: false,
    stdout: '',
    tests: [],
    value: null,
    error: { type: 'InternalError', message: String(err), line: null },
  }
}
