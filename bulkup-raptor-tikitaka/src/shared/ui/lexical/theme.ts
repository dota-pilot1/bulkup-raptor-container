import type { EditorThemeClasses } from 'lexical'

export const editorTheme: EditorThemeClasses = {
  // 문단과 빈 문단 모두 같은 줄높이를 쓴다. 간격은 의미 있는 블록이 만든다.
  paragraph: 'leading-7 text-text-primary',
  heading: {
    h1: 'mt-6 mb-3 border-b border-surface-border-soft pb-2 text-2xl font-bold text-text-primary',
    h2: 'mt-5 mb-2 text-xl font-bold text-text-primary',
    h3: 'mt-5 mb-2 text-lg font-semibold text-text-primary',
  },
  quote: 'text-text-secondary',
  text: {
    bold: 'font-bold text-text-primary',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    code: 'bg-surface-muted text-brand-primary px-1.5 py-0.5 rounded text-[0.875em] font-mono',
  },
  list: {
    ul: 'list-disc ml-5 mb-2',
    ol: 'list-decimal ml-5 mb-2',
    // 체크리스트는 일반 불릿의 여백을 물려받지 않는다. 항목의 체크 표시가
    // 본문 시작선에 맞고, 텍스트만 일정한 간격으로 들여쓰기 된다.
    checklist: 'editor-checklist',
    listitem: 'mb-0.5 text-text-primary',
    listitemChecked: 'editor-list-item-checked',
    listitemUnchecked: 'editor-list-item-unchecked',
    nested: {
      listitem: 'list-none',
    },
  },
  link: 'text-brand-primary underline hover:brightness-110 cursor-pointer',
  // The scroll wrapper owns vertical spacing. Giving both wrapper and table `my-*`
  // doubled the gap between a heading and its table.
  table: 'w-full border-collapse table-fixed',
  tableRow: '',
  tableCell: 'border border-surface-border px-5 py-4 text-sm leading-6 text-text-primary align-top min-w-[80px] break-words whitespace-normal [&_p]:whitespace-pre-wrap',
  tableCellHeader: 'border border-surface-border px-5 py-4 text-sm leading-6 font-semibold text-text-primary text-center align-top break-words whitespace-normal [&_p]:whitespace-pre-wrap',
  tableScrollableWrapper: 'overflow-x-auto mt-2 mb-5',
  code: 'block bg-surface-muted text-text-primary font-mono text-sm p-3 rounded-lg my-4 whitespace-pre overflow-x-auto border border-surface-border-soft',
  codeHighlight: {
    // These are deliberately stable CSS classes. Tailwind cannot reliably
    // emit classes that only exist inside Lexical's runtime theme map.
    atrule: 'editor-token-atrule',
    attr: 'editor-token-attr',
    boolean: 'editor-token-boolean',
    builtin: 'editor-token-builtin',
    cdata: 'editor-token-cdata',
    char: 'editor-token-char',
    class: 'editor-token-class',
    'class-name': 'editor-token-class-name',
    comment: 'editor-token-comment',
    constant: 'editor-token-constant',
    deleted: 'editor-token-deleted',
    doctype: 'editor-token-doctype',
    entity: 'editor-token-entity',
    function: 'editor-token-function',
    important: 'editor-token-important',
    inserted: 'editor-token-inserted',
    keyword: 'editor-token-keyword',
    namespace: 'editor-token-namespace',
    number: 'editor-token-number',
    operator: 'editor-token-operator',
    prolog: 'editor-token-prolog',
    property: 'editor-token-property',
    punctuation: 'editor-token-punctuation',
    regex: 'editor-token-regex',
    selector: 'editor-token-selector',
    string: 'editor-token-string',
    symbol: 'editor-token-symbol',
    tag: 'editor-token-tag',
    url: 'editor-token-url',
    variable: 'editor-token-variable',
  },
}
