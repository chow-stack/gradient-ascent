// Monaco (VS Code's editor), trimmed to the core API + Python. Imported lazily by CodeEditor,
// so it never weighs down the first page load.
import * as monaco from 'monaco-editor/editor/editor.api'
import 'monaco-editor/languages/definitions/python/register'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'

declare global {
  interface Window {
    MonacoEnvironment?: { getWorker: (workerId: string, label: string) => Worker }
  }
}

window.MonacoEnvironment = { getWorker: () => new EditorWorker() }

// Summit colors (tokens.css). Monaco needs literal hex values.
monaco.editor.defineTheme('summit', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'FF9E64' },
    { token: 'string', foreground: 'A5D98A' },
    { token: 'number', foreground: 'FFC94D' },
    { token: 'comment', foreground: '6E7299', fontStyle: 'italic' },
    { token: 'identifier', foreground: 'E4E6F6' },
    { token: 'delimiter', foreground: 'A9ACCB' },
  ],
  colors: {
    'editor.background': '#101127',
    'editor.foreground': '#E4E6F6',
    'editorLineNumber.foreground': '#565A86',
    'editorLineNumber.activeForeground': '#A9ACCB',
    'editor.lineHighlightBackground': '#191B38',
    'editor.lineHighlightBorder': '#00000000',
    'editorCursor.foreground': '#8FCBFF',
    'editor.selectionBackground': '#8FCBFF40',
    'editor.inactiveSelectionBackground': '#8FCBFF22',
    'editorIndentGuide.background1': '#FFFFFF10',
    'editorIndentGuide.activeBackground1': '#FFFFFF24',
    'editorWidget.background': '#1C1E3A',
    'editorWidget.border': '#FFFFFF2B',
    'editorSuggestWidget.background': '#1C1E3A',
    'editorSuggestWidget.selectedBackground': '#262950',
    'scrollbarSlider.background': '#FFFFFF18',
    'scrollbarSlider.hoverBackground': '#FFFFFF28',
    focusBorder: '#00000000',
  },
})

// Re-measure once the self-hosted mono font is ready, or the cursor drifts.
void document.fonts?.ready.then(() => monaco.editor.remeasureFonts())

export { monaco }
