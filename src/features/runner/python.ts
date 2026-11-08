import { useSyncExternalStore } from 'react'
import type { PlayReply, RunOptions, RunResult, TestCase } from './harness'

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pending = new Map<number, (r: any) => void>()
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
export function runPython(code: string, tests: TestCase[] = [], opts: RunOptions = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return request<RunResult>({ code, tests, opts }, timeoutMs, stopped)
}

/**
 * The Play panel's side of Python: load the learner's program once (optionally with new values for variables
 * set at its top), then call into it as the player clicks. Loading again replaces it.
 */
export function playLoad(code: string, values?: Record<string, string>, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return request<PlayReply>({ kind: 'play-load', code, values }, timeoutMs, playStopped)
}

/** Run statements in the loaded program and get back the last expression's value. */
export function playCall<T = unknown>(src: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return request<PlayReply<T>>({ kind: 'play-call', src }, timeoutMs, playStopped as () => PlayReply<T>)
}

function playStopped(): PlayReply {
  return { ok: false, stdout: '', value: null, error: stopped().error }
}

async function request<R>(msg: object, timeoutMs: number, onStop: () => R): Promise<R> {
  await warmUpPython()
  const id = nextId++
  return new Promise<R>((resolve) => {
    const stop = () => {
      pending.delete(id)
      started.delete(id)
      resolve(onStop())
      restart()
    }
    let timer = setTimeout(stop, PACKAGE_LOAD_TIMEOUT_MS)
    started.set(id, () => {
      clearTimeout(timer)
      timer = setTimeout(stop, timeoutMs)
    })
    pending.set(id, (r: R) => {
      clearTimeout(timer)
      started.delete(id)
      resolve(r)
    })
    worker!.postMessage({ id, ...msg })
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
