// lexical-editor의 nodes 배열에 노드를 추가하면 여기에도 타입을 넣어야 한다.
// 여기 빠진 타입은 Lexical이 파싱하기 전에 normalizedNode가 버린다.
const REGISTERED_NODE_TYPES = new Set([
  'root', 'paragraph', 'text', 'linebreak', 'heading', 'quote', 'list', 'listitem',
  'code', 'code-highlight', 'link', 'autolink', 'horizontalrule', 'table', 'tablerow',
  'tablecell', 'image', 'youtube', 'mermaid', 'html-preview', 'component-preview', 'tailwind-tsx-preview',
])

function nodeText(node: Record<string, unknown>): string {
  if (typeof node.text === 'string') return node.text
  if (!Array.isArray(node.children)) return ''
  return node.children.map((child) => {
    if (!child || typeof child !== 'object') return ''
    const childNode = child as Record<string, unknown>
    return childNode.type === 'linebreak' ? '\n' : nodeText(childNode)
  }).join('')
}

function resolveCodeLanguage(source: string, declared: unknown): string {
  const value = typeof declared === 'string' ? declared.toLowerCase() : ''
  const normalized = value.replace(/^code-highlight\./, '').replace(/^language-/, '')
  const aliases: Record<string, string> = { ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', jsonc: 'json' }
  if (normalized && !['text', 'plaintext', 'plain'].includes(normalized)) return aliases[normalized] ?? normalized

  const extension = source.match(/(?:^|[\s/])[^\s/]+\.(tsx?|mts|cts|jsx?|java|json|sql)\b/i)?.[1]?.toLowerCase()
  if (extension) return aliases[extension] ?? extension
  const stripped = source.trim().replace(/^(?:\/\/[^\n]*\n|#[^\n]*\n|\/\*[\s\S]*?\*\/\s*)+/, '').trim()
  if (/^(SELECT|WITH|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+(TABLE|INDEX|VIEW)|ALTER\s+TABLE)\b/im.test(stripped)) return 'sql'
  if (/^(?:package\s+\w+|import\s+java\.|public\s+(?:class|interface|enum)|(?:private|protected)\s+(?:final\s+)?[\w<>,?\[\]]+\s+\w+\s*\(|@(?:Service|Entity|Override|Transactional)\b)/m.test(stripped)) return 'java'
  if (/^\s*[\[{]/.test(stripped)) {
    try { JSON.parse(stripped); return 'json' } catch { /* not JSON */ }
  }
  if (/^(?:import\s+.*from|export\s+(?:default\s+)?|interface\s+\w+|type\s+\w+\s*=|(?:const|let|var)\s+\w+\s*=|function\s+\w+\s*\()/m.test(stripped)) return 'typescript'
  return 'plaintext'
}

function isCodeLikeParagraph(text: string): boolean {
  return text.split(/\r?\n/).some((line) => {
    const value = line.trim()
    return /^(docker\s+|docker-compose|npm |pnpm |yarn |git |curl |ssh |psql |java |\.\/|import |package |public |private |protected |class |interface |enum |return |List<|SELECT\b|INSERT\b|UPDATE\b|DELETE\b|@[A-Za-z])/i.test(value) ||
      /^(services|postgres|image|container_name|restart|ports|volumes|environment|networks|depends_on|command|build|healthcheck|[A-Z][A-Z0-9_]+):/.test(value) ||
      /^(docker-compose\.ya?ml|application(-[\w-]+)?\.ya?ml|package\.json|build\.gradle|pom\.xml)$/.test(value) ||
      /^-\s+/.test(value)
  })
}

function isCodeContinuation(text: string): boolean {
  const value = text.trim()
  return /^-\s+/.test(value) ||
    /^[A-Z][A-Z0-9_]+\s*:/.test(value) ||
    /^[A-Za-z][A-Za-z0-9_.-]*\s*:/.test(value) ||
    /^(?:int|long|boolean|String|List<|Set<|Map<|return\b|\.|[{}();])/.test(value)
}

function restoreJavaCodeLayout(text: string): string {
  if (!/(?:public|private|protected)\s+[\w<>,?\[\]]+\s+\w+\s*\(|@(?:Transactional|Override)|\.stream\(\)/.test(text)) {
    return text
  }
  // 이미 줄바꿈이 정상적으로 들어온 코드는 건드리지 않는다. AI 응답이
  // 한 줄로 접힌 경우에만 아래의 보정 로직을 적용한다.
  const lines = text.split(/\r?\n/)
  if (lines.length > 1 && !lines.some((line) => line.length > 180)) return addJavaMethodSpacing(text)
  const stringLiterals: string[] = []
  const protectedText = text.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, (literal) => {
    const token = `__LEXICAL_STRING_${stringLiterals.length}__`
    stringLiterals.push(literal)
    return token
  })
  const expanded = protectedText
    .replace(/\s*\{\s*/g, ' {\n')
    .replace(/\s*;\s*/g, ';\n')
    .replace(/\s*\}\s*/g, '\n}\n')
    .replace(/\s+(?=@(?:Transactional|Override)|(?:public|private|protected)\s)/g, '\n')
  let indent = 0
  return addJavaMethodSpacing(expanded
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith('}')) indent = Math.max(0, indent - 1)
      const result = `${'    '.repeat(indent)}${line}`
      if (line.endsWith('{')) indent += 1
      return result
    })
    .join('\n')
    .replace(/__LEXICAL_STRING_(\d+)__/g, (_, index: string) => stringLiterals[Number(index)] ?? ''))
}

function addJavaMethodSpacing(text: string): string {
  if (!/@(?:GetMapping|PostMapping|PutMapping|DeleteMapping|Transactional|Override)|\b(?:public|private|protected)\s+/.test(text)) return text
  const output: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    const startsMethod = /^(?:@(?:GetMapping|PostMapping|PutMapping|DeleteMapping|Transactional|Override)|(?:public|private|protected)\s+)/.test(trimmed)
    const previous = output[output.length - 1]?.trim()
    if (startsMethod && previous === '}') output.push('')
    output.push(line)
  }
  return output.join('\n')
}

function mergeCodeNodes(nodes: Record<string, unknown>[]): Record<string, unknown>[] {
  const merged: Record<string, unknown>[] = []
  let pendingBlankParagraphs: Record<string, unknown>[] = []

  const codeText = (node: Record<string, unknown>) =>
    nodeText(node)

  const isBlankParagraph = (node: Record<string, unknown>) =>
    node.type === 'paragraph' && nodeText(node).trim() === ''

  nodes.forEach((node) => {
    const previous = merged[merged.length - 1]
    // AI 결과가 코드 한 줄마다 별도 CodeNode로 오거나, 그 사이에 빈 문단을
    // 끼워 넣어도 하나의 의미 단위(파일 경로 + 코드 내용)로 합친다.
    if (isBlankParagraph(node) || (node.type === 'code' && codeText(node) === '')) {
      pendingBlankParagraphs.push(node)
      return
    }
    if (previous?.type === 'code' && node.type === 'code' && Array.isArray(previous.children) && Array.isArray(node.children)) {
      const previousChild = previous.children[previous.children.length - 1] as Record<string, unknown> | undefined
      const nextChild = node.children[0] as Record<string, unknown> | undefined
      if (previousChild && nextChild) {
        previousChild.text = `${String(previousChild.text ?? '')}${'\n'.repeat(Math.max(1, pendingBlankParagraphs.length + 1))}${codeText(node)}`
        pendingBlankParagraphs = []
        return
      }
    }
    if (pendingBlankParagraphs.length > 0) {
      merged.push(...pendingBlankParagraphs)
      pendingBlankParagraphs = []
    }
    merged.push(node)
  })
  if (pendingBlankParagraphs.length > 0) merged.push(...pendingBlankParagraphs)
  return merged
}

function promoteDocumentStructure(root: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(root.children)) return root
  const output: Record<string, unknown>[] = []
  let codeLines: string[] = []
  let codeMode = false

  const flushCode = () => {
    if (codeLines.length === 0) return
    const source = restoreJavaCodeLayout(codeLines.join('\n'))
    const language = /^(services|postgres|image|container_name|restart|ports|volumes|environment|networks|depends_on|command|build):/m.test(source) || source.includes('docker-compose') ? 'yaml' : 'plaintext'
    output.push({
      type: 'code', language, theme: null, direction: null, format: '', indent: 0, version: 1,
      children: [{ type: 'code-highlight', detail: 0, format: 0, mode: 'normal', style: '', text: source, version: 1 }],
    })
    codeLines = []
  }

  root.children.forEach((child) => {
    if (!child || typeof child !== 'object') return
    const node = child as Record<string, unknown>
    if (node.type === 'paragraph') {
      const text = nodeText(node)
      if (/^\d+[.)]\s+/.test(text.trim()) || /^#{1,3}\s+\d+[.)]?\s+/.test(text.trim())) {
        flushCode()
        codeMode = false
        const headingText = text.trim().replace(/^#{1,3}\s+/, '')
        output.push({
          ...node,
          type: 'heading',
          tag: 'h2',
          children: [{ type: 'text', detail: 0, format: 1, mode: 'normal', style: '', text: headingText, version: 1 }],
        })
        return
      }
      if (isCodeLikeParagraph(text) || (codeMode && isCodeContinuation(text))) {
        codeLines.push(text)
        codeMode = true
        return
      }
    }
    if (node.type === 'code') {
      flushCode()
      output.push(node)
      codeMode = true
      return
    }
    codeMode = false
    flushCode()
    output.push(node)
  })
  flushCode()
  // 사용자가 문단별로 나눈 코드 블록은 문서 구조다. 불러올 때 인접한
  // CodeNode를 합치면 저장 후 문단 구분이 사라지므로 그대로 유지한다.
  return { ...root, children: output }
}

function normalizedNode(value: unknown, parentType: string): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  const source = value as { type?: unknown; text?: unknown; children?: unknown[]; [key: string]: unknown }
  let type = typeof source.type === 'string' && REGISTERED_NODE_TYPES.has(source.type)
    ? source.type
    : undefined

  if (!type && typeof source.text === 'string') {
    if (parentType === 'code') type = 'code-highlight'
    else if (parentType === 'root') type = 'paragraph'
    else type = 'text'
  }
  if (!type && Array.isArray(source.children)) type = 'paragraph'
  if (!type) return null

  if (type === 'paragraph' && !Array.isArray(source.children) && typeof source.text === 'string') {
    return {
      type: 'paragraph', direction: null, format: '', indent: 0, version: 1,
      children: [{ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text: source.text, version: 1 }],
    }
  }
  if (type === 'linebreak') {
    return {
      type: 'linebreak',
      version: typeof source.version === 'number' ? source.version : 1,
    }
  }
  if (type === 'text' || type === 'code-highlight') {
    return {
      ...source,
      type,
      text: typeof source.text === 'string' ? source.text : '',
      detail: typeof source.detail === 'number' ? source.detail : 0,
      format: typeof source.format === 'number' ? source.format : 0,
      mode: typeof source.mode === 'string' ? source.mode : 'normal',
      style: typeof source.style === 'string' ? source.style : '',
      version: typeof source.version === 'number' ? source.version : 1,
    }
  }
  if (Array.isArray(source.children)) {
    const children = source.children
      .map((child) => normalizedNode(child, type!))
      .filter((child): child is Record<string, unknown> => Boolean(child))
    if (type === 'paragraph' && children.length > 0) {
      const textChildren = children.filter((child) => child.type === 'text')
      const text = textChildren.map((child) => String(child.text ?? '')).join('')
      const allInlineCode = textChildren.length === children.length &&
        textChildren.every((child) => typeof child.format === 'number' && (child.format & 16) === 16)
      const looksLikeLongCode = text.length >= 24 || /^(https?:\/\/|ssh |curl |npm |pnpm |docker |git )/.test(text)
      if (allInlineCode && looksLikeLongCode) {
        return {
          type: 'code', language: 'plaintext', theme: null, direction: null,
          format: '', indent: 0, version: 1,
          children: textChildren.map((child) => ({ ...child, type: 'code-highlight', format: 0 })),
        }
      }
    }
    if (type === 'code' && children.length > 0) {
      const codeChildren = children
        .filter((child) => child.type === 'code-highlight' || child.type === 'text' || child.type === 'linebreak')
        // The persisted Lexical format uses `code-highlight` children. That is
        // valid serialized data, but the runtime Prism transform starts from
        // ordinary TextNodes. Convert only the in-memory editor state; the
        // saved/API format remains unchanged.
        .flatMap((child) => {
          if (child.type === 'linebreak') return [child]

          const lines = String(child.text ?? '').split(/\r?\n/)
          return lines.flatMap((line, index) => {
            const textNode = {
              ...child,
              type: 'text',
              format: 0,
              text: line,
            }
            return index < lines.length - 1
              ? [textNode, { type: 'linebreak', version: 1 }]
              : [textNode]
          })
        })
      const sourceText = nodeText(source)
      const language = resolveCodeLanguage(sourceText, source.language)
      const formattedText = restoreJavaCodeLayout(sourceText)
      if (formattedText !== sourceText) {
        const firstCodeChild = codeChildren[0]
        return {
          ...source,
          type,
          children: [{
          ...(firstCodeChild ?? { type: 'text', detail: 0, format: 0, mode: 'normal', style: '', version: 1 }),
            type: 'text',
            format: 0,
            text: formattedText,
          }],
          language,
        }
      }
      return { ...source, type, language, children: codeChildren }
    }
    return { ...source, type, children }
  }
  return { ...source, type, children: [] }
}

export function normalizeLexicalJson(value: string, promoteStructure = true): string | null {
  try {
    const parsed = JSON.parse(value) as { root?: unknown }
    if (!parsed.root || typeof parsed.root !== 'object') return null
    const root = normalizedNode({ ...(parsed.root as Record<string, unknown>), type: 'root' }, 'root')
    if (!root || !Array.isArray(root.children) || root.children.length === 0) return null
    const normalizedRoot = promoteStructure ? promoteDocumentStructure(root) : root
    // Lexical cannot mount an editor state whose root has no children. Invalid
    // or entirely unsupported persisted nodes should fall back to Lexical's
    // default paragraph instead of being passed through as an empty root.
    if (!Array.isArray(normalizedRoot.children) || normalizedRoot.children.length === 0) return null
    return JSON.stringify({ ...parsed, root: normalizedRoot })
  } catch {
    return null
  }
}

function serializedText(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const node = value as { text?: unknown; type?: unknown; children?: unknown[] }
  if (typeof node.text === 'string') return node.text
  if (!Array.isArray(node.children)) return ''
  return node.children.map(serializedText).join(node.type === 'root' ? '\n' : '')
}

export function preservesLexicalContent(source: string, result: string): boolean {
  try {
    const sourceText = serializedText(JSON.parse(source)).replace(/\s+/g, ' ').trim()
    const resultText = serializedText(JSON.parse(result)).replace(/\s+/g, ' ').trim()
    if (sourceText.length < 80) return resultText.length > 0
    const hasSourceCode = /\b(public|private|protected|class|interface|SELECT|docker|import)\b/i.test(sourceText)
    const hasResultCode = /\b(public|private|protected|class|interface|SELECT|docker|import)\b/i.test(resultText)
    // 문서 전체 길이와 비교하면 제목·설명까지 포함되어 정상적인 코드 결과도
    // 누락으로 오판할 수 있다. 코드 문서에서는 코드 토큰이 남아 있는지만
    // 확인하고, 일반 문서는 최소한의 결과 텍스트만 검증한다.
    if (hasSourceCode) return hasResultCode && resultText.length >= 40
    return resultText.length >= Math.min(80, Math.floor(sourceText.length * 0.2))
  } catch {
    return false
  }
}

export function addLexicalHeadingNumbers(value: string): string | null {
  try {
    const parsed = JSON.parse(value) as { root?: Record<string, unknown> }
    const root = parsed.root
    if (!root || !Array.isArray(root.children)) return null
    let number = 1
    const children = root.children.map((child) => {
      if (!child || typeof child !== 'object') return child
      const node = child as Record<string, unknown>
      if (node.type !== 'heading' || !Array.isArray(node.children)) return child
      const text = nodeText(node).trim().replace(/^\d+[.)]\s+/, '')
      if (!text) return child
      number += 1
      return {
        ...node,
        tag: 'h2',
        children: [{ type: 'text', detail: 0, format: 1, mode: 'normal', style: '', text: `${number - 1}. ${text}`, version: 1 }],
      }
    })
    return JSON.stringify({ ...parsed, root: { ...root, children } })
  } catch {
    return null
  }
}

function resetNodeFormatting(node: Record<string, unknown>): Record<string, unknown> {
  const type = node.type
  if (type === 'text' || type === 'code-highlight') {
    return { ...node, type: 'text', detail: 0, format: 0, mode: 'normal', style: '' }
  }
  if (type === 'code') {
    const text = Array.isArray(node.children)
      ? nodeText(node)
      : ''
    return {
      type: 'paragraph', direction: null, format: '', indent: 0, version: 1,
      children: [{ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 }],
    }
  }
  const children = Array.isArray(node.children)
    ? node.children.map((child) => child && typeof child === 'object' ? resetNodeFormatting(child as Record<string, unknown>) : child).filter(Boolean)
    : node.children
  return { ...node, children, format: type === 'root' ? node.format : '', indent: 0, direction: node.direction ?? null }
}

export function resetLexicalFormatting(value: string): string | null {
  const normalized = normalizeLexicalJson(value, false)
  if (!normalized) return null
  try {
    const parsed = JSON.parse(normalized) as { root: Record<string, unknown> }
    return JSON.stringify({ ...parsed, root: resetNodeFormatting(parsed.root) })
  } catch {
    return null
  }
}
