import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'

export type UiCodeEditorProps = {
  value: string
  language?: 'tsx' | 'css' | 'json'
  onChange: (value: string) => void
  readOnly?: boolean
  diagnostics?: string | null
}

/** CodeMirror 구현을 감싼 편집기 경계. 향후 Monaco 교체 시 이 컴포넌트만 바꾼다. */
export function UiCodeEditor({ value, language = 'tsx', onChange, readOnly = false, diagnostics }: UiCodeEditorProps) {
  const extensions = useMemo(() => (language === 'tsx' ? [javascript({ jsx: true, typescript: true })] : []), [language])
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#282c34]">
      <CodeMirror
        value={value}
        height="100%"
        theme={oneDark}
        extensions={extensions}
        editable={!readOnly}
        basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, autocompletion: false }}
        onChange={onChange}
        className="min-h-0 flex-1 overflow-auto text-[13px]"
      />
      {diagnostics ? <div className="border-t border-red-400/30 bg-red-950/70 px-3 py-2 font-mono text-xs leading-5 text-red-200">{diagnostics}</div> : null}
    </div>
  )
}
