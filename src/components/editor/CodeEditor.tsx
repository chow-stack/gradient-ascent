import { useEffect, useRef } from 'react'
import { monaco } from './monaco'

export type CodeEditorProps = {
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  /** 1-based line to mark (e.g. where an error happened). */
  errorLine?: number | null
  /** Called on Cmd/Ctrl+Enter with the editor's current text (fresher than React state). */
  onSubmit?: (value: string) => void
  ariaLabel?: string
  minLines?: number
  maxLines?: number
}

const LINE_HEIGHT = 23

/** Monaco editor that grows with its content. Default export so it can be lazy-loaded. */
export default function CodeEditor({
  value,
  onChange,
  readOnly,
  errorLine,
  onSubmit,
  ariaLabel = 'Code editor',
  minLines = 6,
  maxLines = 22,
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

    const fit = () => {
      const lines = Math.min(maxLines, Math.max(minLines, ed.getModel()!.getLineCount()))
      host.current!.style.height = `${lines * LINE_HEIGHT + 24}px`
      ed.layout()
    }
    fit()
    const sub = ed.onDidChangeModelContent(() => {
      fit()
      cb.current.onChange?.(ed.getValue())
    })
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => cb.current.onSubmit?.(ed.getValue()))
    return () => {
      sub.dispose()
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
    decorations.current?.set(
      errorLine
        ? [
            {
              range: new monaco.Range(errorLine, 1, errorLine, 1),
              options: { isWholeLine: true, className: 'ga-editor-error-line' },
            },
          ]
        : [],
    )
  }, [errorLine])

  return <div ref={host} className="ga-editor" />
}
