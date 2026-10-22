import {
  $createCodeHighlightNode,
  $isCodeHighlightNode,
  PrismTokenizer,
  registerCodeHighlighting,
} from '@lexical/code'
import { $isTextNode, type LexicalNode } from 'lexical'
import type { CodeNode } from '@lexical/code'

// `Tokenizer` is only re-exported through @lexical/code-prism, which is not a
// direct dependency here — take it from the function that consumes it instead.
type Tokenizer = NonNullable<Parameters<typeof registerCodeHighlighting>[1]>

type StyleRange = { start: number; end: number; style: string }
type StyledSegment = { text: string; style: string }

/**
 * 코드 입력 방식은 그대로 두고, 언어가 지정되지 않은 블록만 출력 시
 * 간단한 휴리스틱으로 Prism 언어를 선택한다. 판별이 애매하면 plaintext로
 * 남겨서 잘못된 색상보다 안전한 기본 출력을 우선한다.
 */
export function inferCodeLanguage(source: string, declaredLanguage: string | undefined): string {
  const declared = declaredLanguage?.toLowerCase()
  const normalized = declared
    ?.replace(/^code-highlight\./, '')
    .replace(/^language-/, '')
  const aliases: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    jsonc: 'json',
    yml: 'yaml',
  }
  const declaredCodeLanguage = normalized ? (aliases[normalized] ?? normalized) : undefined
  if (declaredCodeLanguage && !['plaintext', 'text', 'plain'].includes(declaredCodeLanguage)) {
    // Prism's TSX grammar is loaded through a JSX dependency chain. In the
    // packaged/offline WebView that chain can be incomplete (grammar.rest),
    // while the TypeScript grammar is self-contained and handles this source
    // safely enough for syntax highlighting.
    return declaredCodeLanguage
  }

  // 저장 규칙상 코드 블록 첫 줄에 파일 경로 주석이 들어갈 수 있다.
  // 주석 때문에 실제 소스 언어 판별이 plaintext로 떨어지지 않도록 제거한다.
  const fileHint = source.match(/(?:^|[\s/])[^\s/]+\.(tsx?|mts|cts|jsx?|java|css|json|ya?ml|sh|bash|sql)\b/i)?.[1]?.toLowerCase()
  if (fileHint) {
    return aliases[fileHint] ?? fileHint
  }

  const value = source
    .trim()
    .replace(/^(?:\/\/[^\n]*\n|#[^\n]*\n|\/\*[\s\S]*?\*\/\s*)+/, '')
    .trim()
  if (!value) return 'plaintext'
  if (/^(SELECT|WITH|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+(TABLE|INDEX|VIEW)|ALTER\s+TABLE)\b/im.test(value)) return 'sql'
  if (/^(package\s+\w+|import\s+java\.|public\s+(?:class|interface|enum)|(?:private|protected)\s+(?:final\s+)?(?:static\s+)?[\w<>,?\[\]]+\s+\w+\s*\(|@(?:GetMapping|PostMapping|PutMapping|DeleteMapping|Service|Entity|Override|Transactional)\b)/m.test(value)) return 'java'
  if (/^(?:import\s+.*from|export\s+(?:default\s+)?|interface\s+\w+|type\s+\w+\s*=|(?:const|let|var)\s+(?:\{[^}]+\}|\[[^\]]+\]|\w+)\s*=|function\s+\w+\s*\(|(?:if|for|while|switch)\s*\(|<\w+[\s>])/m.test(value)) {
    return 'typescript'
  }
  if (/^(#!\/bin\/|(?:npm|pnpm|yarn|docker|git|curl|cd|mkdir|chmod|java|gradle)\s)/m.test(value)) return 'bash'
  if (/^\s*[\[{].*[\]}]\s*$/s.test(value)) {
    try {
      JSON.parse(value)
      return 'json'
    } catch {
      // Continue with the remaining heuristics.
    }
  }
  if (/^(?:[A-Za-z_][\w.-]*|services|version|networks|volumes):\s*.+/m.test(value) && /:\s*(?:\S+|$)/m.test(value)) return 'yaml'
  if (/^(?:\.|#)[\w-]+\s*\{|--[\w-]+\s*:|\.[\w-]+\s*\{/m.test(value)) return 'css'
  return 'plaintext'
}

// Prism re-tokenizes the whole code block on every change and replaces any node
// whose text/token type no longer matches, which drops inline styles applied by
// the toolbar (highlight, font color). Re-applying the styles while tokenizing
// makes them part of the expected node list, so the diff keeps them in place.
function $collectStyleRanges(codeNode: CodeNode): StyleRange[] {
  const ranges: StyleRange[] = []
  let offset = 0

  codeNode.getChildren().forEach((child) => {
    const size = child.getTextContentSize()
    if ($isTextNode(child)) {
      const style = child.getStyle()
      if (style) {
        ranges.push({ start: offset, end: offset + size, style })
      }
    }
    offset += size
  })

  return ranges
}

function splitByStyle(text: string, start: number, ranges: StyleRange[]): StyledSegment[] {
  const end = start + text.length
  const segments: StyledSegment[] = []
  let cursor = start

  for (const range of ranges) {
    if (range.end <= cursor) continue
    if (range.start >= end) break

    if (range.start > cursor) {
      segments.push({ text: text.slice(cursor - start, range.start - start), style: '' })
      cursor = range.start
    }

    const stop = Math.min(range.end, end)
    segments.push({ text: text.slice(cursor - start, stop - start), style: range.style })
    cursor = stop
  }

  if (cursor < end) {
    segments.push({ text: text.slice(cursor - start), style: '' })
  }

  return segments
}

function $applyStyleRanges(nodes: LexicalNode[], ranges: StyleRange[]): LexicalNode[] {
  if (ranges.length === 0) return nodes

  const result: LexicalNode[] = []
  let offset = 0

  nodes.forEach((node) => {
    const size = node.getTextContentSize()
    if (!$isCodeHighlightNode(node) || size === 0) {
      result.push(node)
      offset += size
      return
    }

    const segments = splitByStyle(node.getTextContent(), offset, ranges)
    offset += size

    if (segments.length === 1) {
      result.push(segments[0].style ? node.setStyle(segments[0].style) : node)
      return
    }

    const highlightType = node.getHighlightType()
    segments.forEach((segment) => {
      const piece = $createCodeHighlightNode(segment.text, highlightType)
      result.push(segment.style ? piece.setStyle(segment.style) : piece)
    })
  })

  return result
}

export const styleAwareCodeTokenizer: Tokenizer = {
  ...PrismTokenizer,
  $tokenize(codeNode, language) {
    const nodes = PrismTokenizer.$tokenize(codeNode, inferCodeLanguage(codeNode.getTextContent(), language))
    return $applyStyleRanges(nodes, $collectStyleRanges(codeNode))
  },
}
