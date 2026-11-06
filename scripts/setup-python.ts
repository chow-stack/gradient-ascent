/**
 * npm run setup:python (also runs after npm install)
 *
 * Downloads the Python packages the app uses from Pyodide's CDN into vendor/pyodide-packages, so Python
 * stays fully offline at runtime. Files are pinned by the lockfile in the pyodide npm package and their
 * hashes are verified. Being offline doesn't fail the install: anything already downloaded keeps working.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Add packages here as lessons need them; their dependencies are included automatically. */
const PACKAGES = ['numpy']

type LockEntry = { file_name: string; sha256: string; depends: string[] }

const root = join(import.meta.dirname, '..')
const pyodide = join(root, 'node_modules/pyodide')
const out = join(root, 'vendor/pyodide-packages')
const version = JSON.parse(readFileSync(join(pyodide, 'package.json'), 'utf8')).version as string
const lock = JSON.parse(readFileSync(join(pyodide, 'pyodide-lock.json'), 'utf8')).packages as Record<string, LockEntry>

const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex')

const needed = new Set<string>()
const add = (name: string) => {
  if (needed.has(name)) return
  needed.add(name)
  lock[name].depends.forEach(add)
}
PACKAGES.forEach(add)

mkdirSync(out, { recursive: true })
let failed = false
for (const name of needed) {
  const { file_name: file, sha256: expected } = lock[name]
  const dest = join(out, file)
  if (existsSync(dest) && sha256(readFileSync(dest)) === expected) continue
  const url = `https://cdn.jsdelivr.net/pyodide/v${version}/full/${file}`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = new Uint8Array(await res.arrayBuffer())
    if (sha256(data) !== expected) throw new Error('hash mismatch')
    writeFileSync(dest, data)
    console.log(`Downloaded ${file}`)
  } catch (e) {
    failed = true
    console.warn(`Couldn't download ${file}: ${(e as Error).message}. Run "npm run setup:python" when online.`)
  }
}
if (!failed) console.log(`Python packages ready: ${[...needed].join(', ')}`)
