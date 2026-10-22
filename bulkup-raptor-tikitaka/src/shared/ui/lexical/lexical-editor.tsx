import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { UrlLinkPlugin } from './plugins/url-link-plugin'
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin'
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'
import { TablePlugin } from '@lexical/react/LexicalTablePlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { ORDERED_LIST, TRANSFORMERS } from '@lexical/markdown'
import { $createCodeNode, CodeNode, CodeHighlightNode, PrismTokenizer, registerCodeHighlighting } from '@lexical/code'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { $isListItemNode, $isListNode, ListNode, ListItemNode } from '@lexical/list'
import { LinkNode } from '@lexical/link'
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table'
import {
  $createParagraphNode,
  $createTextNode,
  $insertNodes,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  KEY_BACKSPACE_COMMAND,
  PASTE_COMMAND,
  type EditorState,
  type LexicalNode,
} from 'lexical'
import { $findMatchingParent } from '@lexical/utils'
import { $isCodeNode } from '@lexical/code'
import { editorTheme } from './theme'
import { LexicalToolbar } from './toolbar'
import { ImageNode } from './nodes/image-node'
import { YoutubeNode } from './nodes/youtube-node'
import { MermaidNode, $createMermaidNode } from './nodes/mermaid-node'
import { HtmlPreviewNode } from './nodes/html-preview-node'
import { ComponentPreviewNode } from './nodes/component-preview-node'
import { TailwindTsxPreviewNode, TAILWIND_TSX_NODE_RUNTIME_KEY } from './nodes/tailwind-tsx-preview-node'
import { DragDropImagePlugin, ImagePlugin } from './plugins/image-plugin'
import { YoutubePlugin } from './plugins/youtube-plugin'
import { TableActionMenuPlugin } from './plugins/table-action-plugin'
import { uploadImageToS3 } from './utils/upload-image'
import { inferCodeLanguage, resolvePrismLanguage, styleAwareCodeTokenizer } from './utils/code-style-tokenizer'
import { normalizeLexicalJson } from './lexical-state'

type LexicalEditorProps = {
  initialState?: string
  onChange: (state: string) => void
  placeholder?: string
  minHeight?: string
  height?: string
  scrollable?: boolean
  readOnly?: boolean
  toolbarVariant?: 'full' | 'simple'
  promoteStructure?: boolean
  searchQuery?: string
  searchMatchIndex?: number
  searchContainerRef?: RefObject<HTMLElement | null>
  onSearchMatchesChange?: (count: number) => void
}

const SEARCH_HIGHLIGHT_NAME = 'pkt-document-search'
const ACTIVE_SEARCH_HIGHLIGHT_NAME = 'pkt-document-search-active'

function LexicalSearchPlugin({
  query,
  activeIndex,
  containerRef,
  onMatchesChange,
}: {
  query: string
  activeIndex: number
  containerRef?: RefObject<HTMLElement | null>
  onMatchesChange?: (count: number) => void
}) {
  const [editor] = useLexicalComposerContext()
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const cssHighlights = (CSS as typeof CSS & {
      highlights?: { set: (name: string, highlight: unknown) => void; delete: (name: string) => void }
    }).highlights
    const HighlightCtor = (window as typeof window & {
      Highlight?: new (...ranges: Range[]) => unknown
    }).Highlight

    if (!cssHighlights || !HighlightCtor) {
      onMatchesChange?.(0)
      return
    }

    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      cssHighlights.delete(SEARCH_HIGHLIGHT_NAME)
      cssHighlights.delete(ACTIVE_SEARCH_HIGHLIGHT_NAME)
      onMatchesChange?.(0)
      return
    }

    const ranges: Range[] = []
    editor.getEditorState().read(() => {
      const visit = (node: LexicalNode) => {
        if ($isTextNode(node)) {
          const element = editor.getElementByKey(node.getKey())
          if (!element) return
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
          let textNode: Node | null
          while ((textNode = walker.nextNode())) {
            const text = textNode.textContent ?? ''
            const lowerText = text.toLowerCase()
            let cursor = 0
            while (cursor < text.length) {
              const start = lowerText.indexOf(normalizedQuery, cursor)
              if (start < 0) break
              const range = document.createRange()
              range.setStart(textNode, start)
              range.setEnd(textNode, start + normalizedQuery.length)
              ranges.push(range)
              cursor = start + normalizedQuery.length
            }
          }
          return
        }
        if ($isElementNode(node)) node.getChildren().forEach(visit)
      }
      visit($getRoot())
    })

    const safeIndex = ranges.length ? Math.min(Math.max(activeIndex, 0), ranges.length - 1) : 0
    cssHighlights.set(SEARCH_HIGHLIGHT_NAME, new HighlightCtor(...ranges))
    if (ranges[safeIndex]) cssHighlights.set(ACTIVE_SEARCH_HIGHLIGHT_NAME, new HighlightCtor(ranges[safeIndex]))
    else cssHighlights.delete(ACTIVE_SEARCH_HIGHLIGHT_NAME)
    onMatchesChange?.(ranges.length)

    const activeRange = ranges[safeIndex]
    if (activeRange && containerRef?.current) {
      window.requestAnimationFrame(() => {
        const container = containerRef.current
        if (!container) return
        const containerRect = container.getBoundingClientRect()
        const rangeRect = activeRange.getBoundingClientRect()
        container.scrollTop += rangeRect.top - containerRect.top - (container.clientHeight - rangeRect.height) / 2
      })
    }

    return () => {
      cssHighlights.delete(SEARCH_HIGHLIGHT_NAME)
      cssHighlights.delete(ACTIVE_SEARCH_HIGHLIGHT_NAME)
      ranges.forEach((range) => range.detach())
    }
  }, [activeIndex, containerRef, editor, onMatchesChange, query, revision])

  useEffect(() => editor.registerUpdateListener(() => {
    if (query.trim()) setRevision((value) => value + 1)
  }), [editor, query])

  return (
    <style dangerouslySetInnerHTML={{ __html: `
      ::highlight(pkt-document-search) {
        background-color: #fef08a; /* yellow-200 */
        color: #1e293b; /* slate-800 */
      }
      ::highlight(pkt-document-search-active) {
        background-color: #f97316; /* orange-500 */
        color: white;
      }
    ` }} />
  )
}

// Number prefixes such as `1. ` remain plain text while typing.
// Numbered lists are still available through the toolbar button.
const MARKDOWN_TRANSFORMERS = TRANSFORMERS.filter(
  (transformer) => transformer !== ORDERED_LIST,
)

// CodeHighlightNode reports canHaveFormat() === false, and $patchStyleText skips
// those nodes entirely. Allowing it lets the toolbar style code text without
// removing syntax classes (setFormat stays a no-op, so bold/italic still can't apply).
const codeHighlightPrototype = CodeHighlightNode.prototype as unknown as {
  canHaveFormat: () => boolean
}
const originalCanHaveFormat = codeHighlightPrototype.canHaveFormat
let styledCodeEditorCount = 0

function CodeHighlightPlugin() {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    if (styledCodeEditorCount === 0) {
      codeHighlightPrototype.canHaveFormat = () => true
    }
    styledCodeEditorCount += 1

    const unregister = registerCodeHighlighting(editor, styleAwareCodeTokenizer)

    // The server document is already in the editor before this plugin mounts.
    // Marking the node dirty is normally enough, but Prism languages are
    // loaded lazily and that first transform can happen before the language is
    // available. Tokenize existing blocks explicitly after mount and retry a
    // few times so a loaded document is highlighted without user editing.
    const highlightExistingBlocks = () => {
      editor.update(() => {
        const visit = (node: LexicalNode) => {
          if ($isCodeNode(node)) {
            // `code-highlight.text` is the storage/API convention, not a Prism
            // language. Lexical skips its transform when the declared language
            // is not loaded, so normalize it before asking Prism to tokenize.
            // This is especially important for documents loaded directly into
            // the read-only Tauri view, where no typing event kicks off a retry.
            const language = inferCodeLanguage(node.getTextContent(), node.getLanguage() ?? undefined)
            const languageChanged = node.getLanguage() !== language
            if (languageChanged) {
              node.setLanguage(language)
            }
            // Do not replace an already highlighted block on every retry. Apart
            // from wasting work, replacing the CodeHighlightNode children while
            // the user is dragging across a multiline block clears the browser's
            // native selection. Only tokenize when the language or child shape
            // actually needs to change.
            const hasHighlightChildren = node
              .getChildren()
              .some((child) => child.getType() === 'code-highlight')
            if (hasHighlightChildren && !languageChanged) return
            const tokens = styleAwareCodeTokenizer.$tokenize(
              node,
              language,
            )
            if (tokens.length > 0 && (!hasHighlightChildren || languageChanged)) {
              node.splice(0, node.getChildrenSize(), tokens)
            }
            return
          }
          if ($isElementNode(node)) node.getChildren().forEach(visit)
        }
        visit($getRoot())
      }, { discrete: true })
    }

    const retryTimers = [0, 250, 1000, 2500].map((delay) =>
      window.setTimeout(highlightExistingBlocks, delay),
    )
    return () => {
      retryTimers.forEach((timer) => window.clearTimeout(timer))
      if (typeof unregister === 'function') {
        unregister()
      }
      styledCodeEditorCount -= 1
      if (styledCodeEditorCount === 0) {
        codeHighlightPrototype.canHaveFormat = originalCanHaveFormat
      }
    }
  }, [editor])
  return null
}

type PrismRenderToken = {
  type: string
  alias?: string | string[]
  content: string | PrismRenderToken | Array<string | PrismRenderToken>
}

type SerializedNode = Record<string, unknown>

type SerializedStyleRange = {
  start: number
  end: number
  style: string
}

function collectSerializedStyleRanges(children: SerializedNode[]): SerializedStyleRange[] {
  const ranges: SerializedStyleRange[] = []
  let offset = 0

  children.forEach((child) => {
    if (child.type === 'linebreak') {
      offset += 1
      return
    }

    const text = typeof child.text === 'string' ? child.text : ''
    const style = typeof child.style === 'string' ? child.style : ''
    if (text && style) ranges.push({ start: offset, end: offset + text.length, style })
    offset += text.length
  })

  return ranges
}

function applySerializedStyleRanges(
  nodes: SerializedNode[],
  ranges: SerializedStyleRange[],
): SerializedNode[] {
  if (ranges.length === 0) return nodes

  const result: SerializedNode[] = []
  let offset = 0

  nodes.forEach((node) => {
    if (node.type === 'linebreak') {
      result.push(node)
      offset += 1
      return
    }

    const text = typeof node.text === 'string' ? node.text : ''
    const end = offset + text.length
    const relevant = ranges.filter((range) => range.end > offset && range.start < end)
    if (node.type !== 'code-highlight' || !text || relevant.length === 0) {
      result.push(node)
      offset = end
      return
    }

    let cursor = offset
    relevant.forEach((range) => {
      if (range.start > cursor) {
        result.push({ ...node, text: text.slice(cursor - offset, range.start - offset), style: '' })
      }
      const stop = Math.min(range.end, end)
      result.push({
        ...node,
        text: text.slice(Math.max(cursor, range.start) - offset, stop - offset),
        style: range.style,
      })
      cursor = stop
    })
    if (cursor < end) result.push({ ...node, text: text.slice(cursor - offset), style: '' })
    offset = end
  })

  return result
}

/** 읽기 전용 상태는 마운트 전에 토큰 노드로 만들어 Lexical이 DOM을 직접 관리하게 한다. */
function createSerializedHighlightNodes(
  value: string | PrismRenderToken | Array<string | PrismRenderToken>,
  inheritedType?: string,
): SerializedNode[] {
  if (typeof value === 'string') {
    const lines = value.split(/\r?\n/)
    return lines.flatMap((line, index) => {
      const textNode = line ? [{
        type: 'code-highlight', detail: 0, format: 0, mode: 'normal', style: '',
        text: line, highlightType: inheritedType, version: 1,
      }] : []
      return index < lines.length - 1
        ? [...textNode, { type: 'linebreak', version: 1 }]
        : textNode
    })
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => createSerializedHighlightNodes(item, inheritedType))
  }
  const alias = Array.isArray(value.alias) ? value.alias[0] : value.alias
  return createSerializedHighlightNodes(value.content, alias || value.type)
}

/**
 * 읽기 전용 문서는 Prism 토큰을 초기 Lexical state에 넣는다.
 * DOM을 직접 replace하면 Lexical의 reconciliation과 충돌하므로 사용하지 않는다.
 */
function addReadOnlyCodeHighlighting(initialState: string | null): string | null {
  if (!initialState) return null
  try {
    const state = JSON.parse(initialState) as { root?: SerializedNode }
    const visit = (node: SerializedNode) => {
      if (node.type === 'code' && Array.isArray(node.children)) {
        const originalChildren = node.children as SerializedNode[]
        const source = node.children.map((child) =>
          child && typeof child === 'object'
            ? (child as SerializedNode).type === 'linebreak'
              ? '\n'
              : typeof (child as SerializedNode).text === 'string'
                ? String((child as SerializedNode).text)
                : ''
            : '',
        ).join('')
        const language = inferCodeLanguage(source, typeof node.language === 'string' ? node.language : undefined)
        node.language = language
        const tokens = PrismTokenizer.tokenize(source, resolvePrismLanguage(language))
        node.children = applySerializedStyleRanges(
          createSerializedHighlightNodes(tokens as string | PrismRenderToken | Array<string | PrismRenderToken>),
          collectSerializedStyleRanges(originalChildren),
        )
      }
      if (Array.isArray(node.children)) {
        node.children.forEach((child) => {
          if (child && typeof child === 'object') visit(child as SerializedNode)
        })
      }
    }
    if (state.root) visit(state.root)
    return JSON.stringify(state)
  } catch {
    return initialState
  }
}

function CodeCopyButtonPlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    let disposed = false
    let root: HTMLElement | null = null
    let observer: MutationObserver | null = null
    let syncTimer = 0
    let layoutFrameId = 0
    let layoutFrames = 0
    const buttons = new Map<HTMLElement, HTMLButtonElement>()

    const setCopyButtonState = (button: HTMLButtonElement, copied: boolean) => {
      button.innerHTML = copied
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
      button.title = copied ? '복사됨' : '코드 복사'
      button.setAttribute('aria-label', copied ? '복사됨' : '코드 복사')
    }

    const getCodeText = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
      if (node.nodeName === 'BR') return '\n'
      return Array.from(node.childNodes).map(getCodeText).join('')
    }

    const copyCode = async (codeElement: HTMLElement, button: HTMLButtonElement) => {
      let source = getCodeText(codeElement)
      const codeElements = Array.from(
        root?.querySelectorAll<HTMLElement>(':scope > code') ?? [],
      )
      const codeIndex = codeElements.indexOf(codeElement)

      editor.getEditorState().read(() => {
        const codeNodes: LexicalNode[] = []
        const visit = (node: LexicalNode) => {
          if ($isCodeNode(node)) codeNodes.push(node)
          if ($isElementNode(node)) {
            node.getChildren().forEach(visit)
          }
        }
        visit($getRoot())
        const codeNode = codeNodes[codeIndex]
        if (codeNode) source = codeNode.getTextContent()
      })

      try {
        await navigator.clipboard.writeText(source)
      } catch {
        const textarea = document.createElement('textarea')
        textarea.value = source
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        textarea.remove()
      }

      setCopyButtonState(button, true)
      window.setTimeout(() => {
        if (button.isConnected) setCopyButtonState(button, false)
      }, 1400)
    }

    // 버튼은 body 기준 fixed라서 모달·드로어·스크롤 컨테이너에 코드 블록이 가려져도
    // 그대로 떠 있는다. 실제로 그 지점이 코드 블록으로 노출돼 있을 때만 보여준다.
    const isSpotExposed = (codeElement: HTMLElement, x: number, y: number) => {
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false
      // 버튼 자신은 물론 그 안의 아이콘 svg까지 걸러야 한다. svg는 HTMLElement가
      // 아니라서 버튼만 걸러내면 판정이 매번 뒤집혀 버튼이 깜박인다.
      const topMost = document
        .elementsFromPoint(x, y)
        .find((element) => !element.closest('[data-code-copy-button]'))
      return Boolean(topMost && codeElement.contains(topMost))
    }

    const syncButtons = () => {
      if (disposed) return

      const nextRoot = editor.getRootElement()
      if (!nextRoot) {
        syncTimer = window.requestAnimationFrame(syncButtons)
        return
      }

      if (root !== nextRoot) {
        observer?.disconnect()
        root = nextRoot
        observer = new MutationObserver(() => {
          syncLayoutBurst()
        })
        observer.observe(root, { childList: true, subtree: true })
      }

      const codeElements = new Set(
        root.querySelectorAll<HTMLElement>(':scope > code'),
      )

      buttons.forEach((button, codeElement) => {
        if (!codeElements.has(codeElement)) {
          button.remove()
          buttons.delete(codeElement)
        }
      })
      codeElements.forEach((codeElement) => {
        let button = buttons.get(codeElement)
        if (!button) {
          button = document.createElement('button')
          button.type = 'button'
          button.className = 'code-copy-button'
          button.setAttribute('contenteditable', 'false')
          button.dataset.codeCopyButton = 'true'
          setCopyButtonState(button, false)
          button.addEventListener('mousedown', (event) => event.preventDefault())
          button.addEventListener('click', (event) => {
            event.preventDefault()
            event.stopPropagation()
            void copyCode(codeElement, button!)
          })
          document.body.appendChild(button)
          buttons.set(codeElement, button)
        }

        const codeRect = codeElement.getBoundingClientRect()
        const top = codeRect.top + 8
        const left = codeRect.right - 34
        const visible =
          codeRect.width > 0 &&
          codeRect.height > 0 &&
          isSpotExposed(codeElement, left + 14, top + 14)
        button.style.display = visible ? 'inline-flex' : 'none'
        if (visible) {
          button.style.top = `${top}px`
          button.style.left = `${left}px`
        }
      })
    }

    const syncLayoutBurst = () => {
      layoutFrames = 0
      window.cancelAnimationFrame(layoutFrameId)
      const tick = () => {
        syncButtons()
        layoutFrames += 1
        if (layoutFrames < 36) {
          layoutFrameId = window.requestAnimationFrame(tick)
        }
      }
      tick()
    }

    syncLayoutBurst()
    window.addEventListener('resize', syncButtons)
    window.addEventListener('scroll', syncButtons, true)
    // 모달이 열리는 것처럼 에디터 밖에서 가려짐이 바뀌는 경우는 이벤트가 오지 않는다.
    const occlusionTimer = window.setInterval(syncButtons, 200)

    return () => {
      disposed = true
      observer?.disconnect()
      window.clearInterval(occlusionTimer)
      window.cancelAnimationFrame(syncTimer)
      window.cancelAnimationFrame(layoutFrameId)
      window.removeEventListener('resize', syncButtons)
      window.removeEventListener('scroll', syncButtons, true)
      buttons.forEach((button) => button.remove())
    }
  }, [editor])

  return null
}

function CodeBlockBackspacePlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(
    () =>
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        (event) => {
          const selection = $getSelection()
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false

          const anchorNode = selection.anchor.getNode()
          const codeNode = $isCodeNode(anchorNode)
            ? anchorNode
            : $findMatchingParent(anchorNode, $isCodeNode)

          if (!codeNode || !codeNode.isEmpty()) return false

          event.preventDefault()
          editor.update(() => {
            const paragraph = $createParagraphNode()
            codeNode.replace(paragraph)
            paragraph.select()
          })
          return true
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor],
  )

  return null
}

function MarkdownCodePastePlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(
    () =>
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          const markdown = 'clipboardData' in event
            ? (event as ClipboardEvent).clipboardData?.getData('text/plain') ?? ''
            : ''
          if (!/```[^\n`]*\n[\s\S]*?```/.test(markdown)) return false

          event.preventDefault()
          const nodes: LexicalNode[] = []
          let cursor = 0
          const fence = /```([^\n`]*)\n([\s\S]*?)```/g
          let match: RegExpExecArray | null

          const appendText = (value: string) => {
            value
              .split(/\r?\n/)
              .map((line) => line.trimEnd())
              .filter((line, index, lines) => line.length > 0 || index < lines.length - 1)
              .forEach((line) => {
                const paragraph = $createParagraphNode()
                if (line) paragraph.append($createTextNode(line))
                nodes.push(paragraph)
              })
          }

          while ((match = fence.exec(markdown))) {
            appendText(markdown.slice(cursor, match.index))
            const code = $createCodeNode(match[1].trim() || undefined)
            code.append($createTextNode(match[2].replace(/\r\n/g, '\n').replace(/\n$/, '')))
            nodes.push(code)
            cursor = match.index + match[0].length
          }
          appendText(markdown.slice(cursor))

          editor.update(() => {
            $insertNodes(nodes)
          })
          return true
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor],
  )

  return null
}

function MermaidCodeNodeTransformPlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(
    () =>
      editor.registerNodeTransform(CodeNode, (codeNode) => {
        const source = codeNode.getTextContent().trim()
        const language = codeNode.getLanguage()?.toLowerCase()
        if (
          !source ||
          (language !== 'mermaid' && language !== 'mmd' && !isMermaidSource(source))
        ) {
          return
        }

        codeNode.replace($createMermaidNode({ source }))
      }),
    [editor],
  )

  return null
}

function OrderedListBackspacePlugin() {
  const [editor] = useLexicalComposerContext()

  useEffect(
    () =>
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        (event) => {
          const selection = $getSelection()
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false

          const anchorNode = selection.anchor.getNode()
          const listItem = $findMatchingParent(anchorNode, $isListItemNode)
          const listNode = listItem?.getParent()
          if (!listItem || !$isListNode(listNode) || listNode.getListType() !== 'number') {
            return false
          }

          const firstChild = listItem.getFirstChild()
          const firstDescendant = listItem.getFirstDescendant()
          const atStart =
            (firstDescendant?.is(anchorNode) && selection.anchor.offset === 0) ||
            (firstChild?.is(anchorNode) && selection.anchor.offset === 0) ||
            (listItem.is(anchorNode) && selection.anchor.offset === 0)
          if (!atStart || !firstChild) return false

          event.preventDefault()
          const paragraph = $createParagraphNode()
          listItem.getChildren().forEach((child) => paragraph.append(child))
          if (listNode.getChildrenSize() === 1) {
            listNode.replace(paragraph)
          } else {
            listItem.insertBefore(paragraph)
            listItem.remove()
          }
          paragraph.selectStart()
          return true
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor],
  )

  return null
}

function EditablePlugin({ readOnly }: { readOnly: boolean }) {
  const [editor] = useLexicalComposerContext()
  useEffect(() => {
    editor.setEditable(!readOnly)
  }, [editor, readOnly])
  return null
}


function isMermaidSource(source: string): boolean {
  return /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4Context|architecture-beta|block-beta)\b/.test(
    source.trim(),
  )
}

export function LexicalEditor({
  initialState,
  onChange,
  placeholder = '내용을 입력하세요...',
  minHeight = '200px',
  height,
  scrollable = false,
  readOnly = false,
  toolbarVariant = 'full',
  // 기존 문서의 문단·인용·코드 블록은 작성자가 정한 서식이다.
  // 자동 추측이 @ExceptionHandler 같은 설명 문장까지 코드로 바꾸지 않도록
  // 일반 편집에서는 구조 승격을 기본으로 사용하지 않는다.
  promoteStructure = false,
  searchQuery = '',
  searchMatchIndex = 0,
  searchContainerRef,
  onSearchMatchesChange,
}: LexicalEditorProps) {
  const handleChange = useCallback(
    (editorState: EditorState) => {
      const serialized = JSON.stringify(editorState.toJSON())
      onChange(serialized)
    },
    [onChange],
  )

  const initialConfig = useMemo(
    () => {
      const normalizedState = initialState
        ? normalizeLexicalJson(initialState, promoteStructure)
        : undefined
      const editorState = readOnly
        ? addReadOnlyCodeHighlighting(normalizedState ?? null) ?? undefined
        : normalizedState ?? undefined

      return {
      namespace: 'DocuNoteEditor',
      theme: editorTheme,
      editable: !readOnly,
      editorState,
      nodes: [
        HeadingNode,
        QuoteNode,
        ListNode,
        ListItemNode,
        CodeNode,
        CodeHighlightNode,
        LinkNode,
        HorizontalRuleNode,
        TableNode,
        TableCellNode,
        TableRowNode,
        ImageNode,
        YoutubeNode,
        MermaidNode,
        HtmlPreviewNode,
        ComponentPreviewNode,
        TailwindTsxPreviewNode,
      ],
      onError: (error: Error) => {
        console.error('Lexical error:', error)
      },
    }
    },
    // initialState is only used as the mount seed; block remount churn while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [readOnly, promoteStructure, TailwindTsxPreviewNode],
  )

  return (
    <LexicalComposer key={TAILWIND_TSX_NODE_RUNTIME_KEY} initialConfig={initialConfig}>
      <div
        className={`lexical-editor flex min-h-0 flex-1 flex-col bg-surface-raised ${readOnly ? 'lexical-editor-readonly' : ''}`}
        style={height ? { height } : undefined}
      >
        {readOnly ? null : (
          <LexicalToolbar
            onImageUpload={toolbarVariant === 'full' ? uploadImageToS3 : undefined}
            variant={toolbarVariant}
          />
        )}
        <div
          className={`lexical-editor-content relative ${scrollable ? 'min-h-0 flex-1 overflow-y-auto' : ''}`}
        >
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="lexical-editor-input px-6 py-6 text-[15px] leading-7 text-text-primary outline-none"
                style={{ minHeight }}
              />
            }
            placeholder={
              readOnly ? null : (
                <div className="lexical-editor-placeholder pointer-events-none absolute left-6 top-5 text-[15px] text-text-muted">
                  {placeholder}
                </div>
              )
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        {readOnly ? null : <HistoryPlugin />}
        <ListPlugin />
        <CheckListPlugin />
        <LinkPlugin />
        {readOnly ? null : <UrlLinkPlugin />}
        <HorizontalRulePlugin />
        <TablePlugin hasHorizontalScroll />
        {/* 읽기 전용 Drawer에서는 Prism 변환이 초기 DOM 동기화와 충돌할 수 있다. */}
        {!readOnly ? <CodeHighlightPlugin /> : null}
        <CodeCopyButtonPlugin />
        {!readOnly ? <CodeBlockBackspacePlugin /> : null}
        {!readOnly ? <MarkdownCodePastePlugin /> : null}
        <MermaidCodeNodeTransformPlugin />
        {!readOnly ? <OrderedListBackspacePlugin /> : null}
        {readOnly ? null : <MarkdownShortcutPlugin transformers={MARKDOWN_TRANSFORMERS} />}
        {readOnly ? null : <ImagePlugin />}
        {readOnly ? null : <DragDropImagePlugin onUpload={uploadImageToS3} />}
        {readOnly ? null : <YoutubePlugin />}
        {readOnly ? null : <TableActionMenuPlugin />}
        <OnChangePlugin onChange={handleChange} />
        <EditablePlugin readOnly={readOnly} />
        {readOnly && searchQuery ? (
          <LexicalSearchPlugin
            query={searchQuery}
            activeIndex={searchMatchIndex}
            containerRef={searchContainerRef}
            onMatchesChange={onSearchMatchesChange}
          />
        ) : null}
      </div>
    </LexicalComposer>
  )
}
