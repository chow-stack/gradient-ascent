/// <reference lib="webworker" />
import type { PyodideAPI } from 'pyodide'
import { HARNESS_PY, type RunOptions, type TestCase } from './harness'

type RunRequest =
  | { id: number; kind?: 'run'; code: string; tests: TestCase[]; opts?: RunOptions }
  | { id: number; kind: 'play-load'; code: string; values?: Record<string, string> }
  | { id: number; kind: 'play-call'; src: string }
  | { id: number; kind: 'vocab'; codes: string[] }

/**
 * Python can reach this worker's JavaScript (`import js`), and code the AI writes runs here unseen. So before
 * Python starts, the worker loses everything that could leave it: fetch only reaches Pyodide's own files, and
 * storage, sockets and other workers are gone. The CSP header on this script (vite.config.ts) backs it up.
 */
function lockDown() {
  const realFetch = self.fetch.bind(self)
  const allowed = new URL('/pyodide/', self.location.origin).href
  const fetchPyodideOnly = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input), self.location.href)
    if (!url.href.startsWith(allowed)) return Promise.reject(new TypeError('The Python runner has no network.'))
    return realFetch(input, init)
  }
  // Browsers keep some of these on the global's prototypes too, so each copy along the chain is replaced.
  const replace = (name: string, value: unknown) => {
    for (let o: object | null = self; o; o = Object.getPrototypeOf(o))
      if (o === self || Object.hasOwn(o, name))
        Object.defineProperty(o, name, { value, writable: false, configurable: false })
  }
  replace('fetch', fetchPyodideOnly)
  const gone = [
    'XMLHttpRequest',
    'WebSocket',
    'WebTransport',
    'EventSource',
    'indexedDB',
    'caches',
    'BroadcastChannel',
    'Worker',
    'SharedWorker',
    'importScripts',
  ]
  for (const name of gone) replace(name, undefined)
}

lockDown()

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
    if (req.kind === 'vocab') {
      self.postMessage({ type: 'started', id })
      const vocab = py.globals.get('__ga_vocab') as (codes: string) => string
      self.postMessage({ type: 'result', id, result: JSON.parse(vocab(JSON.stringify(req.codes))) })
      return
    }
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
