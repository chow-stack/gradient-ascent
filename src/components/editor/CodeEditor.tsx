import { useEffect, useRef } from 'react'
import { monaco } from './monaco'

export type CodeEditorProps = {
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  /** 1-based line to mark (e.g. where an error happened). */
  errorLine?: number | null
  /** 1-based line to point the learner at (e.g. where a bug is). An error on the same line takes priority. */
  markLine?: number | null
  /** Called on Cmd/Ctrl+Enter with the editor's current text (fresher than React state). */
  onSubmit?: (value: string) => void
  ariaLabel?: string
  minLines?: number
  maxLines?: number
  /** Fill the parent's height instead of growing with the code. The parent must have a height. */
  fill?: boolean
  /** Draw its own border (default). Off when it sits inside a box that already has one. */
  frame?: boolean
}

const LINE_HEIGHT = 23

/** Monaco editor that grows with its content. Default export so it can be lazy-loaded. */
export default function CodeEditor({
  value,
  onChange,
  readOnly,
  errorLine,
  markLine,
  onSubmit,
  ariaLabel = 'Code editor',
  minLines = 6,
  maxLines = 22,
  fill = false,
  frame = true,
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const decorations = useRef<monaco.editor.IEditorDecorationsCollection | null>(null)
  // Keep latest callbacks without recreating the editor.
  const cb = useRef({ onChange, onSubmit })
  useEffect(() => {
    cb.current = { onChange, onSubmit }
  })

  useEffect(() => {
    const ed = monaco.editor.create(host.current!, {
      value,
      language: 'python',
      theme: 'summit',
      readOnly,
      ariaLabel,
      fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace",
      fontSize: 14.5,
      lineHeight: LINE_HEIGHT,
      tabSize: 4,
      insertSpaces: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      padding: { top: 12, bottom: 12 },
      lineNumbersMinChars: 3,
      glyphMargin: false,
      folding: false,
      renderLineHighlight: 'line',
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      scrollbar: { alwaysConsumeMouseWheel: false, verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
      // Learning mode: no autocomplete doing the thinking for me.
      quickSuggestions: false,
      suggestOnTriggerCharacters: false,
      wordBasedSuggestions: 'off',
      parameterHints: { enabled: false },
      contextmenu: false,
      fixedOverflowWidgets: true,
    })
    editor.current = ed
    decorations.current = ed.createDecorationsCollection()

    // Grow with what's on screen: a long line's scrollbar takes room too.
    const fit = () => {
      if (fill) return
      const pad = 24
      const height = Math.min(
        maxLines * LINE_HEIGHT + pad,
        Math.max(minLines * LINE_HEIGHT + pad, ed.getContentHeight()),
      )
      if (host.current!.style.height !== `${height}px`) {
        host.current!.style.height = `${height}px`
        ed.layout()
      }
    }
    fit()
    const sized = ed.onDidContentSizeChange(fit)
    const sub = ed.onDidChangeModelContent(() => cb.current.onChange?.(ed.getValue()))
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => cb.current.onSubmit?.(ed.getValue()))
    return () => {
      sub.dispose()
      sized.dispose()
      ed.dispose()
    }
    // The editor is created once; value/readOnly updates are synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const ed = editor.current
    if (ed && ed.getValue() !== value) ed.setValue(value)
  }, [value])

  useEffect(() => {
    editor.current?.updateOptions({ readOnly })
  }, [readOnly])

  useEffect(() => {
    const whole = (line: number, className: string) => ({
      range: new monaco.Range(line, 1, line, 1),
      options: { isWholeLine: true, className },
    })
    decorations.current?.set([
      ...(markLine && markLine !== errorLine ? [whole(markLine, 'ga-editor-mark-line')] : []),
      ...(errorLine ? [whole(errorLine, 'ga-editor-error-line')] : []),
    ])
    // `value` is here because replacing the editor's text clears its decorations.
  }, [errorLine, markLine, value])

  return (
    <div
      ref={host}
      className={['ga-editor', fill && 'h-full', !frame && 'ga-editor--bare'].filter(Boolean).join(' ')}
    />
  )
}
