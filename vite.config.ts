/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { cpSync, createReadStream, existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

/**
 * Serves Pyodide (Python compiled to WebAssembly) from node_modules at /pyodide/ in dev,
 * and copies it into dist/pyodide/ on build. Keeps Python fully offline and out of the JS bundle.
 */
function pyodideAssets(): Plugin {
  const src = resolve(import.meta.dirname, 'node_modules/pyodide')
  const files = ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']
  const mime: Record<string, string> = {
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
        const file = join(src, name)
        if (!files.includes(name) || !existsSync(file)) return next()
        res.setHeader('Content-Type', mime[name.slice(name.lastIndexOf('.'))] ?? 'application/octet-stream')
        createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      mkdirSync(join(outDir, 'pyodide'), { recursive: true })
      for (const f of files) cpSync(join(src, f), join(outDir, 'pyodide', f))
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
