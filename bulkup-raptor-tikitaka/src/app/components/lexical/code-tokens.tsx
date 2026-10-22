import { Fragment, type ReactNode } from 'react'
import { PrismTokenizer } from '@lexical/code'
import { editorTheme } from './theme'

/**
 * 노트 본문의 코드블록과 같은 규칙으로 코드를 색칠한다.
 * 토크나이저도, 색 클래스도 편집기가 쓰는 것을 그대로 쓴다.
 * 그래서 본문 코드블록과 소스 보기 다이얼로그가 갈라질 수 없다.
 */

// Prism이 실제로 읽어 들인 문법만 넘긴다. 없는 이름을 주면 통째로 무색이 된다.
// jsx/tsx 문법은 @lexical/code가 싣지 않으므로 .tsx도 typescript로 읽는다.
const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  css: 'css',
  json: 'json',
  md: 'markdown',
  sql: 'sql',
}

export function codeLanguageOf(fileName: string): string | undefined {
  const ext = fileName.split('.').pop()?.toLowerCase()
  return ext ? LANGUAGE_BY_EXTENSION[ext] : undefined
}

type Token = { type: string; alias?: string | string[]; content: unknown }

function classOf(token: Token): string | undefined {
  const map = editorTheme.codeHighlight as Record<string, string | undefined>
  // alias가 더 좁은 이름이라 먼저 본다. 예: keyword보다 class-name.
  const aliases = Array.isArray(token.alias) ? token.alias : token.alias ? [token.alias] : []
  for (const name of [...aliases, token.type]) {
    if (map[name]) return map[name]
  }
  return undefined
}

function render(node: unknown, key: number): ReactNode {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map((child, index) => <Fragment key={index}>{render(child, index)}</Fragment>)

  const token = node as Token
  const className = classOf(token)
  const inner = render(token.content, key)
  return className ? <span className={className}>{inner}</span> : <>{inner}</>
}

/** 문법을 모르는 파일은 색칠하지 않고 그대로 돌려준다. 억지로 칠하면 엉뚱한 곳이 물든다. */
export function highlightCode(code: string, language: string | undefined): ReactNode {
  if (!language) return code
  try {
    const tokens = PrismTokenizer.tokenize(code, language)
    return tokens.map((token, index) => <Fragment key={index}>{render(token, index)}</Fragment>)
  } catch {
    // 문법 로딩이 실패해도 코드는 읽을 수 있어야 한다.
    return code
  }
}
