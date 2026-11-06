/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { cpSync, createReadStream, existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

/**
 * Serves Pyodide (Python compiled to WebAssembly) from node_modules at /pyodide/ in dev,
 * and copies it into dist/pyodide/ on build. Keeps Python fully offline and out of the JS bundle.
 * Packages like NumPy come from vendor/pyodide-packages (filled by `npm run setup:python`).
 */
function pyodideAssets(): Plugin {
  const src = resolve(import.meta.dirname, 'node_modules/pyodide')
  const files = ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']
  const packages = resolve(import.meta.dirname, 'vendor/pyodide-packages')
  const mime: Record<string, string> = {
    '.whl': 'application/zip',
    '.mjs': 'text/javascript',
    '.wasm': 'application/wasm',
    '.zip': 'application/zip',
    '.json': 'application/json',
  }
  let outDir = 'dist'
  return {
    name: 'gradient-ascent:pyodide',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    configureServer(server) {
      server.middlewares.use('/pyodide', (req, res, next) => {
        const name = (req.url ?? '').split('?')[0].replace(/^\//, '')
        const isPackage = /^[\w.-]+\.whl$/.test(name)
        const file = isPackage ? join(packages, name) : join(src, name)
        if ((!isPackage && !files.includes(name)) || !existsSync(file)) return next()
        res.setHeader('Content-Type', mime[name.slice(name.lastIndexOf('.'))] ?? 'application/octet-stream')
        createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      mkdirSync(join(outDir, 'pyodide'), { recursive: true })
      for (const f of files) cpSync(join(src, f), join(outDir, 'pyodide', f))
      if (existsSync(packages)) cpSync(packages, join(outDir, 'pyodide'), { recursive: true })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), pyodideAssets()],
  worker: { format: 'es' },
  // Monaco (~2.7 MB) is lazy-loaded only on code exercises, and this app runs locally.
  build: { chunkSizeWarningLimit: 3000 },
  // Pre-bundle everything up front so Vite never reloads the page mid-session in dev.
  optimizeDeps: {
    include: [
      'dexie',
      'ts-fsrs',
      'yaml',
      'zod',
      'monaco-editor/editor/editor.api',
      'monaco-editor/languages/definitions/python/register',
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    exclude: ['**/node_modules/**', 'scripts/**'],
  },
})
