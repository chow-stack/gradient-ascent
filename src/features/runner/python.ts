import { useSyncExternalStore } from 'react'
import type { RunOptions, RunResult, TestCase } from './harness'

/**
 * Main-thread client for the Python worker.
 *
 * Python runs in a Web Worker so the page never freezes. An infinite loop can't be interrupted from
 * inside, so on timeout we terminate the worker and start a fresh one (Pyodide reloads from cache).
 */
export type PythonStatus = 'idle' | 'loading' | 'ready' | 'error'

const DEFAULT_TIMEOUT_MS = 4000
/** Loading a package like NumPy for the first time, before the code itself starts. */
const PACKAGE_LOAD_TIMEOUT_MS = 60000

let worker: Worker | null = null
let status: PythonStatus = 'idle'
let ready: Promise<void> | null = null
let nextId = 1
const pending = new Map<number, (r: RunResult) => void>()
const started = new Map<number, () => void>()
const listeners = new Set<() => void>()

function setStatus(s: PythonStatus) {
  status = s
  listeners.forEach((l) => l())
}

function start(): Promise<void> {
  setStatus('loading')
  const w = new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' })
  worker = w
  ready = new Promise<void>((resolve, reject) => {
    w.onmessage = (e: MessageEvent) => {
      const msg = e.data
      if (msg.type === 'ready') {
        setStatus('ready')
        resolve()
      } else if (msg.type === 'boot-error') {
        setStatus('error')
        reject(new Error(msg.message))
      } else if (msg.type === 'started') {
        started.get(msg.id)?.()
      } else if (msg.type === 'result') {
        pending.get(msg.id)?.(msg.result)
        pending.delete(msg.id)
      }
    }
    w.onerror = (e) => {
      setStatus('error')
      reject(new Error(e.message))
    }
  })
  return ready
}

/** Start loading Python in the background (call when a session opens, before it's needed). */
export function warmUpPython(): Promise<void> {
  return ready ?? start()
}

function restart() {
  worker?.terminate()
  worker = null
  ready = null
  for (const [, resolve] of pending) resolve(stopped())
  pending.clear()
  void start().catch(() => {})
}

function stopped(): RunResult {
  return {
    ok: false,
    stdout: '',
    tests: [],
    timedOut: true,
    error: { type: 'Timeout', message: 'Stopped: the code ran too long. Is there a loop that never ends?', line: null },
  }
}

/** Run Python code (and optional tests). Never rejects for Python errors; they come back in the result. */
export async function runPython(
  code: string,
  tests: TestCase[] = [],
  opts: RunOptions = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  await warmUpPython()
  const id = nextId++
  return new Promise<RunResult>((resolve) => {
    const stop = () => {
      pending.delete(id)
      started.delete(id)
      resolve(stopped())
      restart()
    }
    let timer = setTimeout(stop, PACKAGE_LOAD_TIMEOUT_MS)
    started.set(id, () => {
      clearTimeout(timer)
      timer = setTimeout(stop, timeoutMs)
    })
    pending.set(id, (r) => {
      clearTimeout(timer)
      started.delete(id)
      resolve(r)
    })
    worker!.postMessage({ id, code, tests, opts })
  })
}

export function usePythonStatus(): PythonStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => status,
  )
}
