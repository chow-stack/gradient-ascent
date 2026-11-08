import { lazy, Suspense } from 'react'
import type { CodeEditorProps } from './CodeEditor'

const LazyEditor = lazy(() => import('./CodeEditor'))

/** Lazy Monaco editor with a same-sized placeholder while it loads. */
export function CodeEditor(props: CodeEditorProps) {
  const lines = Math.min(props.maxLines ?? 22, Math.max(props.minLines ?? 6, props.value.split('\n').length))
  return (
    <Suspense
      fallback={
        <div
          className={`ga-editor grid place-items-center text-small text-faint${props.fill ? ' h-full' : ''}`}
          style={props.fill ? undefined : { height: lines * 23 + 24 }}
        >
          Loading editor…
        </div>
      }
    >
      <LazyEditor {...props} />
    </Suspense>
  )
}
