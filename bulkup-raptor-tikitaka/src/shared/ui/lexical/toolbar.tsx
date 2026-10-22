import { SpeechInputPlugin } from "./plugins/speech-input-plugin";
import { useCallback, useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { ToolbarHelp } from './toolbar-help'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $createParagraphNode,
  $createTextNode,
  $findMatchingParent,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  INTERNAL_$isBlock,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  type ElementFormatType,
  type LexicalNode,
  type RangeSelection,
  type TextFormatType,
} from 'lexical'
import {
  $getSelectionStyleValueForProperty,
  $patchStyleText,
  $setBlocksType,
} from '@lexical/selection'
import { $createHeadingNode, $createQuoteNode, type HeadingTagType } from '@lexical/rich-text'
import {
  $createListItemNode,
  $createListNode,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from '@lexical/list'
import { INSERT_TABLE_COMMAND } from '@lexical/table'
import { $createCodeNode, $isCodeNode } from '@lexical/code'
import { TOGGLE_LINK_COMMAND } from '@lexical/link'
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/extension'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  Check,
  Code,
  Copy,
  Eraser,
  FileJson,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  GitBranch,
  Minus,
  PanelTop,
  Blocks,
  Quote,
  Redo,
  Strikethrough,
  Table,
  Underline,
  Undo,
  Video,
  X,
} from 'lucide-react'
import { Button } from '../button'
import { CompactSelect } from '../compact-select'
import { INSERT_IMAGE_COMMAND } from './plugins/image-plugin'
import { INSERT_YOUTUBE_COMMAND } from './plugins/youtube-plugin'
import { extractYouTubeId } from './nodes/youtube-node'
import { MermaidPreview } from './mermaid-preview'
import { $createMermaidNode } from './nodes/mermaid-node'
import { $createHtmlPreviewNode } from './nodes/html-preview-node'
import { $createComponentPreviewNode } from './nodes/component-preview-node'
import { $createTailwindTsxPreviewNode } from './nodes/tailwind-tsx-preview-node'
import { ComponentPreview } from './component-preview'
import { TailwindTsxWorkbenchDialog, type TailwindTsxBlock } from './tailwind-tsx-preview'
import { GALLERY_ENTRIES } from '../gallery/registry'
import { HtmlPreview } from './html-preview'

type Props = {
  className?: string
  onImageUpload?: (file: File) => Promise<string>
  variant?: 'full' | 'simple'
}

const FONT_SIZES = ['12px', '13px', '14px', '15px', '16px', '18px', '20px', '24px', '28px', '32px', '40px']
const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: '기본', value: 'inherit' },
  { label: 'Sans Serif', value: 'Arial, sans-serif' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Monospace', value: 'Menlo, Consolas, monospace' },
  { label: 'Pretendard', value: 'Pretendard, sans-serif' },
]

// `clear: true` removes the CSS property instead of setting a value, so code
// blocks fall back to their syntax-highlight colors instead of being overridden.
const TEXT_COLORS: { label: string; value: string; clear?: boolean }[] = [
  { label: '기본', value: 'inherit', clear: true },
  { label: '본문', value: 'var(--foreground)' },
  { label: '보조', value: 'var(--muted-foreground)' },
  { label: '브랜드', value: 'var(--primary)' },
  { label: '위험', value: 'var(--destructive)' },
  { label: '파랑', value: '#2563eb' },
  { label: '보라', value: '#9333ea' },
]

const HIGHLIGHT_COLORS: { label: string; value: string; clear?: boolean }[] = [
  { label: '없음', value: 'transparent', clear: true },
  { label: '브랜드', value: 'color-mix(in srgb, var(--primary) 18%, transparent)' },
  { label: '노랑', value: '#fef08a' },
  { label: '분홍', value: '#fbcfe8' },
  { label: '초록', value: '#bbf7d0' },
  { label: '파랑', value: '#bfdbfe' },
  { label: '주황', value: '#fed7aa' },
]

const DEFAULT_MERMAID_SOURCE = `erDiagram
    POST {
        BIGINT id PK
        VARCHAR_200 title
        TEXT content
        VARCHAR_50 writer
        INTEGER view_count
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }`

const DEFAULT_HTML_PREVIEW = `<main class="workbench">
  <header class="workbench-header"><strong>LOT 작업대</strong><span>공장 [1공장] · 라인 [ETCH]</span><button>조회</button></header>
  <section class="workbench-body">
    <div class="master"><h2>LOT 목록</h2><table><thead><tr><th>LOT</th><th>공정</th><th>상태</th></tr></thead><tbody><tr class="selected"><td>L001</td><td>PHOTO</td><td><span class="badge run">RUN</span></td></tr><tr><td>L002</td><td>ETCH</td><td><span class="badge hold">HOLD</span></td></tr><tr><td>L003</td><td>CLEAN</td><td><span class="badge ready">READY</span></td></tr></tbody></table></div>
    <div class="detail"><div class="summary"><h2>선택 LOT 상세</h2><p><strong>L001</strong> · 제품 A · ETCH · RUN</p><div class="actions"><button>작업 시작</button><button>보류</button><button class="danger">불량 등록</button><button>작업 완료</button></div></div><div class="history"><h2>공정 이력</h2><table><thead><tr><th>시간</th><th>공정</th><th>설비</th><th>이벤트</th><th>처리</th></tr></thead><tbody><tr><td>09:10</td><td>ETCH</td><td>EQP-21</td><td>Track-In</td><td>자동</td></tr><tr class="exception"><td>10:42</td><td>CLEAN</td><td>EQP-07</td><td>HOLD</td><td>작업자</td></tr></tbody></table></div></div>
  </section>
</main>`

const DEFAULT_HTML_CSS = `.workbench { max-width: 980px; margin: auto; background: white; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(15,23,42,.08); }
.workbench-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; background: #fff; }
.workbench-header span { margin-left: auto; color: #64748b; font-size: 13px; }
.workbench button { border: 1px solid #94a3b8; border-radius: 6px; padding: 7px 12px; background: white; color: #172033; cursor: pointer; }
.workbench button:hover { background: #eff6ff; }
.workbench-body { display: grid; grid-template-columns: minmax(260px, .9fr) minmax(420px, 1.5fr); }
.master, .detail { min-width: 0; padding: 18px; }.master { border-right: 1px solid #e2e8f0; background: #f8fafc; }.detail { display: grid; gap: 18px; }
.workbench h2 { margin: 0 0 12px; font-size: 16px; }.workbench table { width: 100%; border-collapse: collapse; font-size: 13px; }.workbench th, .workbench td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; white-space: nowrap; }.workbench th { color: #475569; font-size: 12px; background: #f1f5f9; }.workbench tr.selected { background: #dbeafe; }.workbench tr.exception { background: #fff7ed; }
.badge { display: inline-block; border-radius: 999px; padding: 3px 8px; font-size: 11px; font-weight: 700; }.badge.run { background: #dcfce7; color: #166534; }.badge.hold { background: #fef3c7; color: #92400e; }.badge.ready { background: #dbeafe; color: #1d4ed8; }.actions { display: flex; flex-wrap: wrap; gap: 8px; }.actions .danger { border-color: #fca5a5; color: #b91c1c; }
@media (max-width: 720px) { .workbench-body { grid-template-columns: 1fr; } .master { border-right: 0; border-bottom: 1px solid #e2e8f0; } .workbench-header { flex-wrap: wrap; } .workbench-header span { width: 100%; margin-left: 0; } }`

export function LexicalToolbar({ className, onImageUpload, variant = 'full' }: Props) {
  const [editor] = useLexicalComposerContext()
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({})
  const [fontSize, setFontSize] = useState<string>('15px')
  const [fontFamily, setFontFamily] = useState<string>('inherit')
  const lastSelectionRef = useRef<RangeSelection | null>(null)

  const updateToolbar = useCallback(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
      setActiveFormats({
        bold: selection.hasFormat('bold'),
        italic: selection.hasFormat('italic'),
        underline: selection.hasFormat('underline'),
        strikethrough: selection.hasFormat('strikethrough'),
        code: selection.hasFormat('code'),
      })
      setFontSize($getSelectionStyleValueForProperty(selection, 'font-size', '15px'))
      setFontFamily($getSelectionStyleValueForProperty(selection, 'font-family', 'inherit'))
    }
  }, [])

  const applyStyle = useCallback(
    (styles: Record<string, string | null>) => {
      editor.update(() => {
        let selection = $getSelection()
        if (!$isRangeSelection(selection) && lastSelectionRef.current) {
          const restoredSelection = lastSelectionRef.current.clone()
          $setSelection(restoredSelection)
          selection = restoredSelection
        }
        if ($isRangeSelection(selection)) {
          // Code blocks included: CodeHighlightPlugin unlocks canHaveFormat so
          // $patchStyleText splits and styles the selection here too, and the
          // style-aware tokenizer keeps the style through re-highlighting.
          $patchStyleText(selection, styles)
        }
      })
    },
    [editor],
  )

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        editor.getEditorState().read(() => {
          const selection = $getSelection()
          if ($isRangeSelection(selection)) {
            lastSelectionRef.current = selection.clone()
          }
          updateToolbar()
        })
        return false
      },
      1,
    )
  }, [editor, updateToolbar])

  useEffect(() => {
    return editor.registerCommand(
      CAN_UNDO_COMMAND,
      (payload) => {
        setCanUndo(payload)
        return false
      },
      1,
    )
  }, [editor])

  useEffect(() => {
    return editor.registerCommand(
      CAN_REDO_COMMAND,
      (payload) => {
        setCanRedo(payload)
        return false
      },
      1,
    )
  }, [editor])

  const format = (type: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, type)
  }

  const formatParagraph = () => {
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return

      // CodeNode는 $setBlocksType만으로 일반 문단으로 돌아가지 않는다.
      // 선택한 코드 블록의 텍스트를 새 문단에 넣어 서식을 완전히 지운다.
      const codeBlocks = new Set<ReturnType<typeof $createCodeNode>>()
      selection.getNodes().forEach((node) => {
        const codeBlock = $isCodeNode(node)
          ? node
          : $findMatchingParent(node, $isCodeNode)
        if (codeBlock) codeBlocks.add(codeBlock)
      })
      if (codeBlocks.size > 0) {
        codeBlocks.forEach((codeBlock) => {
          const paragraph = $createParagraphNode().append($createTextNode(codeBlock.getTextContent()))
          codeBlock.replace(paragraph)
          if (codeBlocks.size === 1) paragraph.selectEnd()
        })
        return
      }

      $setBlocksType(selection, () => $createParagraphNode())
    })
  }

  const formatHeading = (tag: HeadingTagType) => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createHeadingNode(tag))
      }
    })
  }

  const formatQuote = () => {
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return

      const codeBlocks = new Set<ReturnType<typeof $createCodeNode>>()
      selection.getNodes().forEach((node) => {
        const codeBlock = $isCodeNode(node)
          ? node
          : $findMatchingParent(node, $isCodeNode)
        if (codeBlock) codeBlocks.add(codeBlock)
      })

      // A code block and a quote are different block formats. When converting
      // a code block, recreate it as plain quote text so code formatting does
      // not remain as unexpected inline-code styling inside the quote.
      if (codeBlocks.size > 0) {
        codeBlocks.forEach((codeBlock) => {
          const quote = $createQuoteNode().append(
            $createTextNode(codeBlock.getTextContent()),
          )
          codeBlock.replace(quote)
          if (codeBlocks.size === 1) quote.selectEnd()
        })
        return
      }

      const root = $getRoot()
      const selectedBlocks: LexicalNode[] = []
      const selectedBlockKeys = new Set<string>()
      selection.getNodes().forEach((node) => {
        const block = INTERNAL_$isBlock(node)
          ? node
          : $findMatchingParent(node, INTERNAL_$isBlock)
        if (!block || block.getParent() !== root || selectedBlockKeys.has(block.getKey())) return
        selectedBlockKeys.add(block.getKey())
        selectedBlocks.push(block)
      })

      // 연속된 일반 문단은 각각의 quote로 바꾸지 않고 하나의 quote 컨테이너로 묶는다.
      // 제목·목록처럼 구조가 다른 블록은 기존 변환 규칙을 유지한다.
      if (selectedBlocks.length > 1 && selectedBlocks.every((block) => block.getType() === 'paragraph')) {
        const quote = $createQuoteNode()
        selectedBlocks[0].replace(quote)
        selectedBlocks.forEach((block) => quote.append(block))
        return
      }

      $setBlocksType(selection, () => $createQuoteNode())
    })
  }

  const clearFormatting = () => {
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return

      // 선택한 텍스트의 인라인 서식과 직접 지정한 CSS를 제거한다.
      selection.setFormat(0)
      selection.setStyle('')
      selection.getNodes().forEach((node) => {
        if ($isTextNode(node)) {
          node.setFormat(0)
          node.setStyle('')
        } else if ($isElementNode(node)) {
          node.setTextFormat(0)
          node.setFormat('')
        }
      })

      // 제목·인용·목록·코드 블록을 일반 문단으로 되돌린다. 텍스트 내용은 유지한다.
      $setBlocksType(selection, () => $createParagraphNode())
    })
  }

  const formatCodeBlock = () => {
    editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return

      const points = selection.getStartEndPoints()
      if (!points) return
      const [startPoint, endPoint] = points
      const startBlock = $findMatchingParent(startPoint.getNode(), INTERNAL_$isBlock)
      const endBlock = $findMatchingParent(endPoint.getNode(), INTERNAL_$isBlock)

      // A partial selection inside one block should become its own code block.
      if (
        startBlock &&
        startBlock === endBlock &&
        $isElementNode(startBlock) &&
        startPoint.type === 'text' &&
        endPoint.type === 'text' &&
        startPoint.getNode().getKey() !== startBlock.getKey()
      ) {
        const textNodes = startBlock.getAllTextNodes()
        const getOffset = (point: typeof startPoint) => {
          let offset = 0
          for (const textNode of textNodes) {
            if (textNode.getKey() === point.getNode().getKey()) return offset + point.offset
            offset += textNode.getTextContentSize()
          }
          return offset
        }

        const startOffset = getOffset(startPoint)
        const endOffset = getOffset(endPoint)
        const text = startBlock.getTextContent()
        const selectedText = text.slice(startOffset, endOffset)

        if (selectedText.length > 0) {
          const replacement: LexicalNode[] = []
          const beforeText = text.slice(0, startOffset)
          const afterText = text.slice(endOffset)
          if (beforeText) replacement.push($createParagraphNode().append($createTextNode(beforeText)))
          const codeNode = $createCodeNode().append($createTextNode(selectedText))
          replacement.push(codeNode)
          if (afterText) replacement.push($createParagraphNode().append($createTextNode(afterText)))

          const [firstReplacement, ...remainingReplacements] = replacement
          startBlock.replace(firstReplacement)
          let previous = firstReplacement
          for (const next of remainingReplacements) {
            previous.insertAfter(next)
            previous = next
          }
          codeNode.selectEnd()
          return
        }
      }

      // 여러 문단을 선택하면 Lexical이 각 문단을 각각의 코드 블록으로
      // 바꾼다. 인용처럼 하나의 블록으로 합치지는 않는다.
      $setBlocksType(selection, () => $createCodeNode())
    })
  }

  const align = (alignment: ElementFormatType) => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, alignment)
  }

  if (variant === 'simple') {
    return (
      <div
        className={`lexical-toolbar relative flex flex-wrap items-center gap-1 border-b border-surface-border-soft bg-surface-muted py-2 pl-3 pr-14 ${className ?? ''}`}
      >
        <ToolbarButton onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} disabled={!canUndo} title="실행 취소">
          <Undo className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} disabled={!canRedo} title="다시 실행">
          <Redo className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={clearFormatting} title="서식 지우기">
          <Eraser className="size-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={formatParagraph} title="본문">
          <span className="px-1 text-[11px] font-semibold">P</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => formatHeading('h1')} title="Heading 1">
          <Heading1 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => formatHeading('h2')} title="Heading 2">
          <Heading2 className="size-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={() => format('bold')} active={activeFormats.bold} title="Bold (⌘B)">
          <Bold className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => format('italic')} active={activeFormats.italic} title="Italic (⌘I)">
          <Italic className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => format('underline')} active={activeFormats.underline} title="Underline (⌘U)">
          <Underline className="size-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)} title="Bulleted list">
          <List className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)} title="Numbered list">
          <ListOrdered className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={formatQuote} title="인용">
          <Quote className="size-3.5" />
        </ToolbarButton>
        <MarkdownInsertButton />
        <MermaidInsertButton />
        <HtmlPreviewInsertButton />
        <ComponentPreviewInsertButton />
        <TailwindTsxPreviewInsertButton />
        <LinkInsertButton />
        <ToolbarHelp variant="simple" hasImageUpload={false} />
        <SpeechInputPlugin />
      </div>
    )
  }

  return (
    <div
      className={`lexical-toolbar relative flex flex-wrap items-center gap-1 border-b border-surface-border-soft bg-surface-muted py-2 pl-3 pr-14 ${className ?? ''}`}
    >
      <ToolbarButton onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} disabled={!canUndo} title="실행 취소">
        <Undo className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} disabled={!canRedo} title="다시 실행">
        <Redo className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={clearFormatting} title="서식 지우기">
        <Eraser className="size-3.5" />
      </ToolbarButton>

      <Divider />

      <FontFamilySelect value={fontFamily} onChange={(value) => applyStyle({ 'font-family': value })} />
      <FontSizeSelect value={fontSize} onChange={(value) => applyStyle({ 'font-size': value })} />

      <Divider />

      <ToolbarButton onClick={() => format('bold')} active={activeFormats.bold} title="Bold (⌘B)">
        <Bold className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => format('italic')} active={activeFormats.italic} title="Italic (⌘I)">
        <Italic className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => format('underline')} active={activeFormats.underline} title="Underline (⌘U)">
        <Underline className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => format('strikethrough')} active={activeFormats.strikethrough} title="Strikethrough">
        <Strikethrough className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => format('code')} active={activeFormats.code} title="Inline code">
        <Code className="size-3.5" />
      </ToolbarButton>
      <ColorPicker
        icon={<Baseline className="size-3.5" />}
        title="글씨 색상"
        colors={TEXT_COLORS}
        onPick={(color) => applyStyle({ color })}
      />
      <ColorPicker
        icon={<Highlighter className="size-3.5" />}
        title="형광펜"
        colors={HIGHLIGHT_COLORS}
        onPick={(color) => applyStyle({ 'background-color': color })}
      />

      <Divider />

      <ToolbarButton onClick={formatParagraph} title="본문">
        <span className="px-1 text-[11px] font-semibold">P</span>
      </ToolbarButton>
      <ToolbarButton onClick={() => formatHeading('h1')} title="Heading 1">
        <Heading1 className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => formatHeading('h2')} title="Heading 2">
        <Heading2 className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => formatHeading('h3')} title="Heading 3">
        <Heading3 className="size-3.5" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)} title="Bulleted list">
        <List className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)} title="Numbered list">
        <ListOrdered className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined)} title="체크리스트">
        <ListChecks className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={formatQuote} title="인용">
        <Quote className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={formatCodeBlock} title="Code block">
        <span className="px-1 font-mono text-[10px] font-semibold">{'{ }'}</span>
      </ToolbarButton>
      <ApiSpecInsertButton />
      <MarkdownInsertButton />
      <MermaidInsertButton />
      <HtmlPreviewInsertButton />
      <ComponentPreviewInsertButton />
      <TailwindTsxPreviewInsertButton />

      <Divider />

      <ToolbarButton onClick={() => align('left')} title="왼쪽 정렬">
        <AlignLeft className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => align('center')} title="가운데 정렬">
        <AlignCenter className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => align('right')} title="오른쪽 정렬">
        <AlignRight className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => align('justify')} title="양쪽 정렬">
        <AlignJustify className="size-3.5" />
      </ToolbarButton>

      <Divider />

      <LinkInsertButton />
      <ToolbarButton onClick={() => editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined)} title="수평선 삽입">
        <Minus className="size-3.5" />
      </ToolbarButton>
      <TableInsertButton />

      {onImageUpload ? (
        <>
          <Divider />
          <ImageInsertButton onUpload={onImageUpload} />
        </>
      ) : null}

      <YoutubeInsertButton />
      <ToolbarHelp variant="full" hasImageUpload={Boolean(onImageUpload)} />
      <SpeechInputPlugin />
    </div>
  )
}

/** API 계약을 일정한 heading·quote·JSON code block 구조로 삽입한다. */
function ApiSpecInsertButton() {
  const [editor] = useLexicalComposerContext()
  const [open, setOpen] = useState(false)
  const [agentRequestOpen, setAgentRequestOpen] = useState(false)
  const [method, setMethod] = useState('POST')
  const [path, setPath] = useState('/signup')
  const [summary, setSummary] = useState('새 사용자를 등록한다.')
  const [requestBody, setRequestBody] = useState('{\n  "loginId": "",\n  "password": "",\n  "displayName": ""\n}')
  const [successStatus, setSuccessStatus] = useState('201 Created')
  const [responseBody, setResponseBody] = useState('{\n  "id": 1,\n  "loginId": "",\n  "displayName": ""\n}')
  const [errorCases, setErrorCases] = useState('400 Bad Request: 요청 값이 올바르지 않음\n409 Conflict: 중복된 식별값')
  const [scope, setScope] = useState('')
  const [serverRules, setServerRules] = useState('')
  const [verification, setVerification] = useState('')

  const appendApiSpec = () => {
    const normalizedPath = path.trim()
    if (!normalizedPath) return

    editor.focus()
    editor.update(() => {
      const nodes: LexicalNode[] = [
        $createHeadingNode('h2').append($createTextNode(`${method} ${normalizedPath}`)),
        $createQuoteNode().append($createTextNode(summary.trim() || 'API의 목적을 설명합니다.')),
        $createHeadingNode('h3').append($createTextNode('요청')),
        $createCodeNode('json').append($createTextNode(requestBody.trim() || '{}')),
        $createHeadingNode('h3').append($createTextNode(`성공 응답 · ${successStatus.trim() || '200 OK'}`)),
        $createCodeNode('json').append($createTextNode(responseBody.trim() || '{}')),
        $createHeadingNode('h3').append($createTextNode('오류 응답')),
        $createQuoteNode().append($createTextNode(errorCases.trim() || '오류 조건을 작성합니다.')),
      ]
      if (scope.trim()) {
        nodes.push(
          $createHeadingNode('h3').append($createTextNode('API 범위')),
          $createQuoteNode().append($createTextNode(scope.trim())),
        )
      }
      if (serverRules.trim()) {
        nodes.push(
          $createHeadingNode('h3').append($createTextNode('서버 처리 규칙')),
          $createQuoteNode().append($createTextNode(serverRules.trim())),
        )
      }
      if (verification.trim()) {
        nodes.push(
          $createHeadingNode('h3').append($createTextNode('구현·검증 연결')),
          $createQuoteNode().append($createTextNode(verification.trim())),
        )
      }
      const selection = $getSelection()
      if ($isRangeSelection(selection)) selection.insertNodes(nodes)
      else $getRoot().append(...nodes)
    })
    setOpen(false)
  }

  return (
    <>
      <ToolbarButton onClick={() => setOpen(true)} title="API 설계 블록 삽입">
        <FileJson className="size-3.5" />
      </ToolbarButton>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[240] bg-black/35" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-[241] flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-surface-border-soft bg-surface-raised shadow-2xl"
            style={{ width: 'calc(100vw - 4rem)', maxWidth: '1560px', height: 'calc(100vh - 4rem)' }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-surface-border-soft px-5 py-4">
              <div>
                <Dialog.Title className="text-base font-semibold text-text-primary">API 설계 블록 삽입</Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-text-muted">요청·응답 계약을 입력하면 표준 Lexical 제목, 설명, JSON 코드 블록으로 문서에 넣습니다.</Dialog.Description>
              </div>
              <div className="flex items-center gap-2"><Button variant="secondary" size="sm" onClick={() => setAgentRequestOpen(true)}>API 설계 요청 {"{}"}</Button><Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="닫기"><X className="size-4" /></Button></Dialog.Close></div>
            </div>
            <div
              className="grid min-h-0 flex-1 overflow-hidden"
              style={{ gridTemplateColumns: 'minmax(360px, 0.8fr) minmax(560px, 1.2fr)' }}
            >
              <section className="min-h-0 space-y-5 overflow-y-auto border-r border-surface-border-soft p-6">
                <div><p className="text-sm font-black text-text-primary">API 정보</p><p className="mt-1 text-xs text-text-muted">식별 정보와 오류 정책을 먼저 정의합니다.</p></div>
                <div className="space-y-4 rounded-lg border border-surface-border-soft bg-surface-muted/30 p-4">
                <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                  <label className="space-y-1.5"><span className="text-xs font-black text-text-secondary">Method</span><CompactSelect value={method} onChange={(event) => setMethod(event.target.value)} wrapperClassName="w-full"><option>GET</option><option>POST</option><option>PATCH</option><option>PUT</option><option>DELETE</option></CompactSelect></label>
                  <label className="space-y-1.5"><span className="text-xs font-black text-text-secondary">Path</span><input value={path} onChange={(event) => setPath(event.target.value)} className="h-9 w-full rounded-md border border-surface-border-soft bg-surface-raised px-3 font-mono text-sm text-text-primary outline-none transition-colors focus:border-brand-border focus:ring-1 focus:ring-brand-border/15" placeholder="/signup" /></label>
                </div>
                <label className="block space-y-1.5"><span className="text-xs font-black text-text-secondary">설명</span><input value={summary} onChange={(event) => setSummary(event.target.value)} className="h-10 w-full rounded-md border border-surface-border-soft bg-surface-raised px-3 text-sm text-text-primary outline-none transition-colors focus:border-brand-border focus:ring-1 focus:ring-brand-border/15" placeholder="이 API가 하는 일" /></label>
                </div>
                <label className="flex min-h-[180px] flex-col gap-1.5"><span className="text-xs font-black text-text-secondary">오류 응답 <span className="font-medium text-text-muted">(한 줄에 하나)</span></span><textarea value={errorCases} onChange={(event) => setErrorCases(event.target.value)} className="min-h-0 flex-1 resize-y rounded-md border border-surface-border-soft bg-surface-raised p-3 text-sm leading-6 text-text-primary outline-none transition-colors focus:border-brand-border focus:ring-1 focus:ring-brand-border/15" /></label>
                <div className="space-y-4 border-t border-surface-border-soft pt-5"><div><p className="text-sm font-black text-text-primary">설계 보강 <span className="text-xs font-semibold text-text-muted">(선택)</span></p><p className="mt-1 text-xs text-text-muted">구현 범위·처리 규칙·테스트 기준까지 문서화할 때 작성합니다.</p></div><label className="block space-y-1.5"><span className="text-xs font-black text-text-secondary">API 범위</span><textarea value={scope} onChange={(event) => setScope(event.target.value)} rows={3} placeholder="예: 로그인과 토큰 발급은 별도 API에서 다룬다." className="w-full resize-y rounded-md border border-surface-border-soft bg-surface-raised p-3 text-sm leading-6 text-text-primary outline-none transition-colors focus:border-brand-border focus:ring-1 focus:ring-brand-border/15" /></label><label className="block space-y-1.5"><span className="text-xs font-black text-text-secondary">서버 처리 규칙</span><textarea value={serverRules} onChange={(event) => setServerRules(event.target.value)} rows={4} placeholder="예: 비밀번호는 해시로 저장하고, 기본 역할 부여까지 하나의 트랜잭션으로 처리한다." className="w-full resize-y rounded-md border border-surface-border-soft bg-surface-raised p-3 text-sm leading-6 text-text-primary outline-none transition-colors focus:border-brand-border focus:ring-1 focus:ring-brand-border/15" /></label><label className="block space-y-1.5"><span className="text-xs font-black text-text-secondary">구현·검증 연결</span><textarea value={verification} onChange={(event) => setVerification(event.target.value)} rows={3} placeholder="예: 정상 가입, 중복 ID, 유효성 실패, 롤백을 통합 테스트로 확인한다." className="w-full resize-y rounded-md border border-surface-border-soft bg-surface-raised p-3 text-sm leading-6 text-text-primary outline-none transition-colors focus:border-brand-border focus:ring-1 focus:ring-brand-border/15" /></label></div>
              </section>
              <section className="flex min-h-0 flex-col overflow-y-auto p-6"><div className="mb-5"><p className="text-sm font-black text-text-primary">요청·응답 계약</p><p className="mt-1 text-xs text-text-muted">클라이언트가 보내는 값과 서버가 반환하는 값을 위에서 아래로 정의합니다.</p></div><div className="flex min-h-[680px] flex-1 flex-col gap-5"><label className="flex min-h-[280px] flex-1 flex-col gap-1.5"><span className="text-xs font-black text-text-secondary">요청 JSON</span><textarea value={requestBody} onChange={(event) => setRequestBody(event.target.value)} spellCheck={false} className="min-h-0 flex-1 resize-y rounded-md border border-surface-border-soft bg-surface-raised p-3 font-mono text-xs leading-6 text-text-primary outline-none transition-colors focus:border-brand-border focus:ring-1 focus:ring-brand-border/15" /></label><div className="flex min-h-[320px] flex-1 flex-col gap-3 border-t border-surface-border-soft pt-5"><label className="space-y-1.5"><span className="text-xs font-black text-text-secondary">성공 상태</span><input value={successStatus} onChange={(event) => setSuccessStatus(event.target.value)} className="h-9 w-full rounded-md border border-surface-border-soft bg-surface-raised px-3 text-sm text-text-primary outline-none transition-colors focus:border-brand-border focus:ring-1 focus:ring-brand-border/15" /></label><label className="flex min-h-0 flex-1 flex-col gap-1.5"><span className="text-xs font-black text-text-secondary">성공 응답 JSON</span><textarea value={responseBody} onChange={(event) => setResponseBody(event.target.value)} spellCheck={false} className="min-h-0 flex-1 resize-y rounded-md border border-surface-border-soft bg-surface-raised p-3 font-mono text-xs leading-6 text-text-primary outline-none transition-colors focus:border-brand-border focus:ring-1 focus:ring-brand-border/15" /></label></div></div></section>
            </div>
            <div className="flex justify-end gap-2 border-t border-surface-border-soft bg-surface-muted/60 px-6 py-4"><Button variant="secondary" size="sm" onClick={() => setOpen(false)}>취소</Button><Button size="sm" onClick={appendApiSpec} disabled={!path.trim()}>문서에 삽입</Button></div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {agentRequestOpen && <ApiDesignAgentRequestDialog method={method} path={path} summary={summary} requestBody={requestBody} successStatus={successStatus} responseBody={responseBody} errorCases={errorCases} scope={scope} serverRules={serverRules} verification={verification} onClose={() => setAgentRequestOpen(false)} />}
    </>
  )
}

type ApiDesignAgentRequestDialogProps = {
  method: string
  path: string
  summary: string
  requestBody: string
  successStatus: string
  responseBody: string
  errorCases: string
  scope: string
  serverRules: string
  verification: string
  onClose: () => void
}

/** API 계약 초안을 검토·보완하도록 Codex에 전달할 요청문을 만든다. */
function ApiDesignAgentRequestDialog({ method, path, summary, requestBody, successStatus, responseBody, errorCases, scope, serverRules, verification, onClose }: ApiDesignAgentRequestDialogProps) {
  const [additionalInstruction, setAdditionalInstruction] = useState('')
  const [includeBasic, setIncludeBasic] = useState(true)
  const [includeRequest, setIncludeRequest] = useState(true)
  const [includeResponse, setIncludeResponse] = useState(true)
  const [includeErrors, setIncludeErrors] = useState(true)
  const [includeScope, setIncludeScope] = useState(true)
  const [includeServerRules, setIncludeServerRules] = useState(true)
  const [includeVerification, setIncludeVerification] = useState(true)
  const [copied, setCopied] = useState(false)

  const instruction = [
    '다음 API 설계 초안을 검토하고 보완해 주세요.',
    '',
    '## 작업 목표',
    '회원가입 등 현재 기능의 HTTP 계약을 일관되게 설계합니다. 확정되지 않은 구현 세부사항은 사실처럼 단정하지 말고, 필요한 결정 항목으로 구분해 주세요.',
    '',
    '## 현재 API 설계 초안',
    ...(includeBasic ? [`- Method: ${method}`, `- Path: ${path}`, `- 설명: ${summary || '미작성'}`] : []),
    ...(includeRequest ? ['', '### 요청 JSON', '```json', requestBody || '{}', '```'] : []),
    ...(includeResponse ? ['', `### 성공 응답 · ${successStatus || '미작성'}`, '```json', responseBody || '{}', '```'] : []),
    ...(includeErrors ? ['', '### 오류 응답', errorCases || '미작성'] : []),
    ...(includeScope ? ['', '### API 범위', scope || '미작성 — 현재 기능 문맥을 기준으로 포함·제외 범위를 제안해 주세요.'] : []),
    ...(includeServerRules ? ['', '### 서버 처리 규칙', serverRules || '미작성 — 검증, 트랜잭션, 보안·영속성 규칙을 제안해 주세요.'] : []),
    ...(includeVerification ? ['', '### 구현·검증 연결', verification || '미작성 — 계층별 구현 순서와 핵심 테스트 케이스를 제안해 주세요.'] : []),
    ...(additionalInstruction.trim() ? ['', '## 추가 지시', additionalInstruction.trim()] : []),
    '',
    '## 응답 방식',
    '- API 범위, 요청·응답 계약, 서버 처리 규칙, 오류 응답, 구현·검증 연결을 각각 검토한다.',
    '- 빠진 검증·상태 코드·보안 노출을 지적하고, 수정이 필요하면 바로 적용 가능한 초안을 제시한다.',
    '- 최종 문서에 넣을 때는 제목·일반 본문·JSON 코드 블록이 분리된 Lexical 구조를 사용한다.',
    '- API 범위·요청·응답의 일반 설명은 인용문이 아닌 기본 본문 텍스트로 작성한다. 제목 크기와 여백으로 위계를 구분한다.',
    '- 인용문은 보안 경고, 반드시 지켜야 할 예외, 결정 보류처럼 특별히 강조할 내용에만 사용한다. 인용문 바로 아래에 실행 규칙 목록을 따로 붙이지 말고, 실행 규칙은 일반 문단으로 맥락을 설명한 뒤 목록으로 묶는다.',
  ].join('\n')

  const copyInstruction = async () => {
    try {
      await navigator.clipboard.writeText(instruction)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[260] bg-black/40" role="dialog" aria-modal="true" aria-label="API 설계 요청">
      <section className="flex h-full w-full flex-col overflow-hidden bg-surface-raised shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-surface-border-soft px-5 py-4"><div><h2 className="text-lg font-black text-text-primary">API 설계 요청</h2><p className="mt-1 text-xs font-semibold text-text-muted">현재 계약 초안과 추가 지시를 조합해 Codex에 보낼 요청문을 만듭니다.</p></div><div className="flex items-center gap-2"><Button variant="primary" size="sm" onClick={() => void copyInstruction()}>{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? '복사됨' : '지시문 복사'}</Button><Button variant="ghost" size="icon" onClick={onClose} aria-label="닫기"><X className="size-4" /></Button></div></header>
        <div className="grid min-h-0 flex-1 grid-cols-2 overflow-hidden">
          <section className="min-h-0 overflow-auto border-r border-surface-border-soft p-5"><label className="block"><span className="text-sm font-black text-text-primary">추가 지시</span><span className="mt-1 block text-[11px] font-semibold text-text-muted">설계 시 고려할 업무 규칙, 보안 조건, 제외 범위를 적습니다.</span><textarea value={additionalInstruction} onChange={(event) => setAdditionalInstruction(event.target.value)} rows={6} placeholder="예: 역할은 요청으로 받지 말고 기본 USER 역할만 부여해 주세요." className="mt-3 w-full resize-y rounded-lg border border-surface-border-soft bg-surface p-3 text-xs leading-5 text-text-primary outline-none focus:border-brand-border" /></label><div className="mt-6"><h3 className="text-sm font-black text-text-primary">현재 초안 포함</h3><p className="mt-1 text-[11px] font-semibold text-text-muted">비어 있는 보강 항목은 Codex가 문맥에 맞는 초안을 제안합니다.</p><div className="mt-3 overflow-hidden rounded-lg border border-surface-border-soft">{[[includeBasic, setIncludeBasic, '기본 정보', `${method} ${path || '/path'}`], [includeRequest, setIncludeRequest, '요청 JSON', requestBody ? '현재 입력값 포함' : '비어 있음'], [includeResponse, setIncludeResponse, '성공 응답', successStatus || '상태 미작성'], [includeErrors, setIncludeErrors, '오류 응답', errorCases ? '현재 입력값 포함' : '비어 있음'], [includeScope, setIncludeScope, 'API 범위', scope ? '현재 입력값 포함' : 'Codex 초안 제안'], [includeServerRules, setIncludeServerRules, '서버 처리 규칙', serverRules ? '현재 입력값 포함' : 'Codex 초안 제안'], [includeVerification, setIncludeVerification, '구현·검증 연결', verification ? '현재 입력값 포함' : 'Codex 초안 제안']].map(([checked, setChecked, label, description]) => <label key={String(label)} className="flex cursor-pointer items-center gap-3 border-b border-surface-border-soft px-3 py-3 last:border-b-0 hover:bg-surface-muted/60"><input type="checkbox" checked={Boolean(checked)} onChange={(event) => (setChecked as (value: boolean) => void)(event.target.checked)} className="size-4 accent-brand-primary" /><span className="min-w-0"><strong className="block text-xs text-text-primary">{String(label)}</strong><span className="block truncate text-[11px] text-text-muted">{String(description)}</span></span></label>)}</div></div></section>
          <section className="flex min-h-0 flex-col bg-surface-muted/20 p-5"><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-black text-text-primary">Codex에 보낼 API 설계 요청</h3><p className="mt-1 text-[11px] font-semibold text-text-muted">선택 항목과 추가 지시에 따라 즉시 갱신됩니다.</p></div><Button size="sm" onClick={() => void copyInstruction()}>{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? '복사됨' : '전체 복사'}</Button></div><textarea value={instruction} readOnly aria-label="생성된 API 설계 요청" className="min-h-[560px] flex-1 resize-y rounded-lg border border-surface-border-soft bg-surface-raised p-3 font-mono text-[11px] leading-5 text-text-secondary outline-none" /></section>
        </div>
        <footer className="shrink-0 border-t border-surface-border-soft bg-surface-raised px-5 py-3 text-[11px] text-text-muted">Agent는 설계 초안을 제안하고, 최종 계약은 이 API 설계 블록에서 검토한 뒤 문서에 삽입합니다.</footer>
      </section>
    </div>
  )
}

function MermaidInsertButton() {
  const [editor] = useLexicalComposerContext()
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState(DEFAULT_MERMAID_SOURCE)

  const handleInsert = () => {
    const content = source.trim()
    if (!content) return

    editor.focus()
    editor.update(() => {
      const mermaidNode = $createMermaidNode({ source: content })
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        selection.insertNodes([mermaidNode])
      } else {
        $getRoot().append(mermaidNode)
      }
    })
    setOpen(false)
  }

  return (
    <>
      <ToolbarButton onClick={() => setOpen(true)} title="Mermaid 다이어그램 삽입">
        <GitBranch className="size-3.5" />
      </ToolbarButton>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[240] bg-black/35" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[241] flex max-h-[calc(100vh-2rem)] w-[min(1180px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-surface-border-soft bg-surface-raised shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-surface-border-soft px-5 py-4">
              <div className="min-w-0">
                <Dialog.Title className="text-base font-semibold text-text-primary">
                  Mermaid 다이어그램 삽입
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-text-muted">
                  왼쪽에 Mermaid 문법을 입력하면 오른쪽에서 미리 볼 수 있습니다.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
                  aria-label="닫기"
                >
                  <X className="size-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 lg:grid-cols-2">
              <section className="flex min-h-[360px] min-w-0 flex-col overflow-hidden rounded-md border border-surface-border-soft">
                <div className="border-b border-surface-border-soft bg-surface-muted px-4 py-3">
                  <h3 className="text-xs font-black uppercase tracking-[0.12em] text-text-secondary">
                    편집
                  </h3>
                </div>
                <textarea
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                      event.preventDefault()
                      handleInsert()
                    }
                  }}
                  autoFocus
                  spellCheck={false}
                  className="min-h-[320px] flex-1 resize-none bg-surface-raised px-4 py-4 font-mono text-xs leading-6 text-text-primary outline-none"
                  placeholder={'erDiagram\n    POST {\n        BIGINT id PK\n    }'}
                />
              </section>

              <section className="flex min-h-[360px] min-w-0 flex-col overflow-hidden rounded-md border border-surface-border-soft">
                <div className="border-b border-surface-border-soft bg-surface-muted px-4 py-3">
                  <h3 className="text-xs font-black uppercase tracking-[0.12em] text-text-secondary">
                    미리보기
                  </h3>
                </div>
                <div className="min-h-[320px] flex-1 overflow-auto bg-surface-raised p-4">
                  {source.trim() ? (
                    <MermaidPreview block={{ id: 'dialog-preview', source: source.trim() }} index={0} />
                  ) : (
                    <div className="grid min-h-[280px] place-items-center text-sm text-text-muted">
                      Mermaid 코드를 입력하세요.
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-surface-border-soft bg-surface-muted/60 px-5 py-4">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9 min-w-16 px-4"
                onClick={() => setOpen(false)}
              >
                취소
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9 min-w-20 px-4"
                disabled={!source.trim()}
                onClick={handleInsert}
              >
                삽입
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

/** 갤러리에 등록된 컴포넌트를 골라 props를 맞춘 뒤 본문에 꽂는다. */
function ComponentPreviewInsertButton() {
  const [editor] = useLexicalComposerContext()
  const [open, setOpen] = useState(false)
  const [componentId, setComponentId] = useState(GALLERY_ENTRIES[0]?.id ?? '')
  const [props, setProps] = useState<Record<string, unknown>>(() => ({ ...(GALLERY_ENTRIES[0]?.defaultProps ?? {}) }))
  const entry = GALLERY_ENTRIES.find((item) => item.id === componentId)

  const selectEntry = (nextId: string) => {
    setComponentId(nextId)
    const next = GALLERY_ENTRIES.find((item) => item.id === nextId)
    setProps({ ...(next?.defaultProps ?? {}) })
  }

  const handleInsert = () => {
    if (!entry) return
    editor.focus()
    editor.update(() => {
      const node = $createComponentPreviewNode({ componentId: entry.id, props })
      const selection = $getSelection()
      if ($isRangeSelection(selection)) selection.insertNodes([node])
      else $getRoot().append(node)
    })
    setOpen(false)
  }

  return (
    <>
      <ToolbarButton onClick={() => setOpen(true)} title="컴포넌트 미리보기 삽입">
        <Blocks className="size-3.5" />
      </ToolbarButton>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[240] bg-black/35" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[241] flex max-h-[calc(100vh-2rem)] w-[min(900px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-surface-border-soft bg-surface-raised shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-surface-border-soft px-5 py-4">
              <div>
                <Dialog.Title className="text-base font-semibold text-text-primary">컴포넌트 미리보기 삽입</Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-text-muted">
                  코드가 아니라 갤러리 컴포넌트의 id와 props만 저장합니다. 렌더는 앱의 실제 구현이 맡습니다.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild><button type="button" className="flex size-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-muted" aria-label="닫기"><X className="size-4" /></button></Dialog.Close>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <label className="flex items-center gap-2">
                <span className="text-xs font-black text-text-secondary">컴포넌트</span>
                <select
                  value={componentId}
                  onChange={(event) => selectEntry(event.target.value)}
                  className="rounded-md border border-surface-border bg-surface-raised px-2 py-1 text-xs font-bold text-text-primary"
                >
                  {GALLERY_ENTRIES.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>

              {entry ? (
                <div className="mt-4">
                  <ComponentPreview block={{ componentId: entry.id, props }} />
                  <p className="mt-2 text-[11px] font-semibold text-text-muted">
                    위 컨트롤로 맞춘 값이 그대로 저장됩니다. 저장한 뒤에도 문서에서 다시 바꿔볼 수 있습니다.
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-xs font-bold text-text-muted">갤러리에 등록된 컴포넌트가 없습니다.</p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-surface-border-soft px-5 py-3">
              <Dialog.Close asChild>
                <button type="button" className="ui-icon-button h-9 px-4 text-[13px] font-black">취소</button>
              </Dialog.Close>
              <button type="button" onClick={handleInsert} disabled={!entry} className="ui-icon-button-brand h-9 px-4 text-[13px] font-black disabled:opacity-40">
                삽입
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

/** 자유 Tailwind TSX 샘플은 코드 문자열 자체를 새 Lexical 노드에 저장한다. */
function TailwindTsxPreviewInsertButton() {
  const [editor] = useLexicalComposerContext()
  const [open, setOpen] = useState(false)

  const handleInsert = (block: TailwindTsxBlock) => {
    editor.focus()
    editor.update(() => {
      const node = $createTailwindTsxPreviewNode(block)
      const selection = $getSelection()
      if ($isRangeSelection(selection)) selection.insertNodes([node])
      else $getRoot().append(node)
    })
  }

  return (
    <>
      <ToolbarButton onClick={() => setOpen(true)} title="Tailwind TSX 컴포넌트 삽입">
        <span className="font-mono text-[10px] font-black">TW</span>
      </ToolbarButton>
      <TailwindTsxWorkbenchDialog open={open} onOpenChange={setOpen} onSave={handleInsert} />
    </>
  )
}

function HtmlPreviewInsertButton() {
  const [editor] = useLexicalComposerContext()
  const [open, setOpen] = useState(false)
  const [html, setHtml] = useState(DEFAULT_HTML_PREVIEW)
  const [css, setCss] = useState(DEFAULT_HTML_CSS)

  const handleInsert = () => {
    if (!html.trim()) return
    editor.focus()
    editor.update(() => {
      const node = $createHtmlPreviewNode({ html: html.trim(), css: css.trim() })
      const selection = $getSelection()
      if ($isRangeSelection(selection)) selection.insertNodes([node])
      else $getRoot().append(node)
    })
    setOpen(false)
  }

  return (
    <>
      <ToolbarButton onClick={() => setOpen(true)} title="HTML 화면 미리보기 삽입">
        <PanelTop className="size-3.5" />
      </ToolbarButton>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[240] bg-black/35" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[241] flex max-h-[calc(100vh-2rem)] w-[min(1400px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-surface-border-soft bg-surface-raised shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-surface-border-soft px-5 py-4">
              <div>
                <Dialog.Title className="text-base font-semibold text-text-primary">HTML 화면 미리보기 삽입</Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-text-muted">React 문서 안에 격리된 HTML/CSS 화면 목업 블록으로 저장합니다.</Dialog.Description>
              </div>
              <Dialog.Close asChild><button type="button" className="flex size-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-muted" aria-label="닫기"><X className="size-4" /></button></Dialog.Close>
            </div>
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <section className="flex min-h-[500px] min-w-0 flex-col overflow-hidden rounded-md border border-surface-border-soft">
                <div className="grid grid-cols-2 border-b border-surface-border-soft bg-surface-muted">
                  <label className="border-r border-surface-border-soft px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-text-secondary">HTML</label>
                  <label className="px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-text-secondary">CSS</label>
                </div>
                <div className="grid min-h-0 flex-1 grid-cols-2">
                  <textarea value={html} onChange={(event) => setHtml(event.target.value)} spellCheck={false} className="min-h-[460px] resize-none border-r border-surface-border-soft bg-surface-raised p-4 font-mono text-xs leading-6 text-text-primary outline-none" />
                  <textarea value={css} onChange={(event) => setCss(event.target.value)} spellCheck={false} className="min-h-[460px] resize-none bg-surface-raised p-4 font-mono text-xs leading-6 text-text-primary outline-none" />
                </div>
              </section>
              <section className="flex min-h-[500px] min-w-0 flex-col overflow-hidden rounded-md border border-surface-border-soft">
                <div className="border-b border-surface-border-soft bg-surface-muted px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-text-secondary">미리보기</div>
                <div className="min-h-[460px] flex-1 overflow-auto bg-surface-muted p-3"><HtmlPreview block={{ html, css }} /></div>
              </section>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-surface-border-soft bg-surface-muted/60 px-5 py-4">
              <Button type="button" variant="secondary" size="sm" className="h-9 min-w-16 px-4" onClick={() => setOpen(false)}>취소</Button>
              <Button type="button" size="sm" className="h-9 min-w-20 px-4" disabled={!html.trim()} onClick={handleInsert}>삽입</Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

function MarkdownInsertButton() {
  const [editor] = useLexicalComposerContext()
  const [open, setOpen] = useState(false)
  const [markdown, setMarkdown] = useState('')

  const handleInsert = () => {
    const content = markdown.trim()
    if (!content) return

    editor.focus()
    editor.update(() => {
      const nodes = createMarkdownNodes(content)
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        selection.insertNodes(nodes)
      } else {
        $getRoot().append(...nodes)
      }
    })
    setMarkdown('')
    setOpen(false)
  }

  return (
    <>
      <ToolbarButton onClick={() => setOpen(true)} title="Markdown 삽입">
        <span className="font-mono text-[10px] font-bold">MD</span>
      </ToolbarButton>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[240] bg-black/35" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[241] flex w-[min(760px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-surface-border-soft bg-surface-raised shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-surface-border-soft px-5 py-4">
              <div className="min-w-0">
                <Dialog.Title className="text-base font-semibold text-text-primary">
                  Markdown 삽입
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-text-muted">
                  붙여넣은 Markdown을 Lexical 블록으로 변환해서 현재 커서 위치에 넣습니다.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
                  aria-label="닫기"
                >
                  <X className="size-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="p-5">
              <textarea
                value={markdown}
                onChange={(event) => setMarkdown(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault()
                    handleInsert()
                  }
                }}
                autoFocus
                spellCheck={false}
                className="ui-input min-h-[340px] w-full resize-y rounded-md border px-4 py-3 font-mono text-xs leading-6 outline-none"
                placeholder={[
                  '## Sql 문제 정답',
                  '',
                  '```sql',
                  'SELECT *',
                  'FROM users;',
                  '```',
                  '',
                  '## Sql 주요 문법 설명',
                  '',
                  '- SELECT는 조회할 컬럼을 지정합니다.',
                ].join('\n')}
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-surface-border-soft bg-surface-muted/60 px-5 py-4">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9 min-w-16 px-4"
                onClick={() => setOpen(false)}
              >
                취소
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9 min-w-20 px-4"
                disabled={!markdown.trim()}
                onClick={handleInsert}
              >
                삽입
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

function createMarkdownNodes(markdown: string): LexicalNode[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const nodes: LexicalNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    const codeStart = trimmed.match(/^```(\w+)?/)
    if (codeStart) {
      const language = codeStart[1]
      const codeLines: string[] = []
      index += 1

      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1

      const codeNode = $createCodeNode(language)
      codeNode.append($createTextNode(codeLines.join('\n')))
      nodes.push(codeNode)
      continue
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      const headingNode = $createHeadingNode(`h${level}` as 'h1' | 'h2' | 'h3')
      appendInlineMarkdown(headingNode, heading[2])
      nodes.push(headingNode)
      index += 1
      continue
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const list = $createListNode('bullet')
      while (index < lines.length && /^[-*+]\s+/.test(lines[index].trim())) {
        const item = $createListItemNode()
        appendInlineMarkdown(item, lines[index].trim().replace(/^[-*+]\s+/, ''))
        list.append(item)
        index += 1
      }
      nodes.push(list)
      continue
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const list = $createListNode('number')
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        const item = $createListItemNode()
        appendInlineMarkdown(item, lines[index].trim().replace(/^\d+\.\s+/, ''))
        list.append(item)
        index += 1
      }
      nodes.push(list)
      continue
    }

    const paragraphLines = [trimmed]
    index += 1
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^```/.test(lines[index].trim()) &&
      !/^(#{1,3})\s+/.test(lines[index].trim()) &&
      !/^[-*+]\s+/.test(lines[index].trim()) &&
      !/^\d+\.\s+/.test(lines[index].trim())
    ) {
      paragraphLines.push(lines[index].trim())
      index += 1
    }

    const paragraph = $createParagraphNode()
    appendInlineMarkdown(paragraph, paragraphLines.join(' '))
    nodes.push(paragraph)
  }

  return nodes
}

function appendInlineMarkdown(
  node: ReturnType<typeof $createParagraphNode> | ReturnType<typeof $createHeadingNode> | ReturnType<typeof $createListItemNode>,
  text: string,
) {
  const pattern = /(\*\*[^*]+?\*\*|`[^`]+?`)/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      node.append($createTextNode(text.slice(cursor, match.index)))
    }

    const token = match[0]
    const textNode = $createTextNode(token.slice(token.startsWith('**') ? 2 : 1, token.endsWith('**') ? -2 : -1))
    if (token.startsWith('**')) {
      textNode.toggleFormat('bold')
    } else {
      textNode.toggleFormat('code')
    }
    node.append(textNode)
    cursor = match.index + token.length
  }

  if (cursor < text.length) {
    node.append($createTextNode(text.slice(cursor)))
  }
}

function LinkInsertButton() {
  const [editor] = useLexicalComposerContext()

  const handleClick = () => {
    const url = window.prompt('링크 URL을 입력하세요 (빈 값으로 제거)')
    if (url === null) return
    const trimmed = url.trim()
    if (!trimmed) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
      return
    }
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, normalized)
  }

  return (
    <ToolbarButton onClick={handleClick} title="링크 삽입/제거">
      <LinkIcon className="size-3.5" />
    </ToolbarButton>
  )
}

function YoutubeInsertButton() {
  const [editor] = useLexicalComposerContext()

  const handleClick = () => {
    const url = window.prompt('YouTube URL을 입력하세요')
    if (!url) return
    const videoId = extractYouTubeId(url)
    if (!videoId) {
      alert('유효한 YouTube URL이 아닙니다.')
      return
    }
    editor.dispatchCommand(INSERT_YOUTUBE_COMMAND, { videoId })
  }

  return (
    <ToolbarButton onClick={handleClick} title="YouTube 영상 삽입">
      <Video className="size-3.5" />
    </ToolbarButton>
  )
}

function ImageInsertButton({ onUpload }: { onUpload: (file: File) => Promise<string> }) {
  const [editor] = useLexicalComposerContext()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 10 * 1024 * 1024) {
      alert('이미지 크기는 10MB 이하만 업로드 가능합니다.')
      return
    }

    try {
      const url = await onUpload(file)
      editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
        src: url,
        altText: file.name,
      })
    } catch (err) {
      console.error('Image upload failed:', err)
      alert('이미지 업로드에 실패했습니다.')
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <>
      <ToolbarButton onClick={() => fileInputRef.current?.click()} title="이미지 삽입">
        <ImageIcon className="size-3.5" />
      </ToolbarButton>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
    </>
  )
}

function ColorPicker({
  icon,
  title,
  colors,
  onPick,
}: {
  icon: React.ReactNode
  title: string
  colors: { label: string; value: string; clear?: boolean }[]
  onPick: (color: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <ToolbarButton onClick={() => setOpen((value) => !value)} active={open} title={title}>
        {icon}
      </ToolbarButton>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1 flex items-center gap-1 rounded-md border border-surface-border bg-surface-raised px-2 py-1.5 shadow-md">
          {colors.map((color) => (
            <button
              key={color.value}
              type="button"
              title={color.label}
              onClick={() => {
                onPick(color.clear ? null : color.value)
                setOpen(false)
              }}
              onMouseDown={(event) => event.preventDefault()}
              className="size-5 rounded border border-surface-border transition-transform hover:scale-110"
              style={{
                backgroundColor: color.value,
                backgroundImage:
                  color.value === 'inherit' || color.value === 'transparent'
                    ? 'linear-gradient(to bottom right, transparent calc(50% - 0.5px), var(--destructive) calc(50% - 0.5px), var(--destructive) calc(50% + 0.5px), transparent calc(50% + 0.5px))'
                    : undefined,
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function FontSizeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const current = FONT_SIZES.includes(value) ? value : '15px'
  return (
    <CompactSelect
      value={current}
      onChange={(event) => onChange(event.target.value)}
      title="글씨 크기"
      wrapperClassName="w-[68px] shrink-0"
      className="h-8 min-h-8 [height:32px] [min-height:32px] pl-2.5 pr-7 text-xs font-semibold"
    >
      {FONT_SIZES.map((size) => (
        <option key={size} value={size}>
          {size.replace('px', '')}
        </option>
      ))}
    </CompactSelect>
  )
}

function FontFamilySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const match = FONT_FAMILIES.find((font) => font.value === value)
  return (
    <CompactSelect
      value={match ? match.value : 'inherit'}
      onChange={(event) => onChange(event.target.value)}
      title="글씨체"
      wrapperClassName="w-[100px] shrink-0"
      className="h-8 min-h-8 [height:32px] [min-height:32px] pl-2.5 pr-7 text-xs font-semibold"
    >
      {FONT_FAMILIES.map((font) => (
        <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
          {font.label}
        </option>
      ))}
    </CompactSelect>
  )
}

const TABLE_COLS = 6
const TABLE_ROWS = 6

function TableInsertButton() {
  const [editor] = useLexicalComposerContext()
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<{ row: number; col: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const insert = (rows: number, columns: number) => {
    editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows: String(rows), columns: String(columns) })
    setOpen(false)
    setHovered(null)
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <ToolbarButton onClick={() => setOpen((value) => !value)} active={open} title="표 삽입">
        <Table className="size-3.5" />
      </ToolbarButton>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1 rounded-md border border-surface-border bg-surface-raised p-2 shadow-md">
          <p className="mb-1.5 text-center text-[11px] text-text-muted">
            {hovered ? `${hovered.row} x ${hovered.col}` : '행 x 열 선택'}
          </p>
          <div className="flex flex-col gap-0.5">
            {Array.from({ length: TABLE_ROWS }, (_, rowIndex) => (
              <div key={rowIndex} className="flex gap-0.5">
                {Array.from({ length: TABLE_COLS }, (_, colIndex) => {
                  const active =
                    hovered && rowIndex < hovered.row && colIndex < hovered.col
                  return (
                    <button
                      key={colIndex}
                      type="button"
                      className={`size-5 rounded-sm border transition-colors ${
                        active
                          ? 'border-brand-border bg-brand-glass'
                          : 'border-surface-border bg-surface-strong hover:border-brand-border hover:bg-brand-glass'
                      }`}
                      onMouseEnter={() => setHovered({ row: rowIndex + 1, col: colIndex + 1 })}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => insert(rowIndex + 1, colIndex + 1)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ToolbarButton({
  children,
  onClick,
  active,
  disabled,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(event) => event.preventDefault()}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`flex size-8 shrink-0 items-center justify-center rounded-md transition-colors ${
        active
          ? 'bg-brand-glass text-brand-primary'
          : 'text-text-secondary hover:bg-surface-strong hover:text-text-primary'
      } disabled:pointer-events-none disabled:opacity-30`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="mx-1.5 h-6 w-px shrink-0 bg-surface-border-soft" />
}
