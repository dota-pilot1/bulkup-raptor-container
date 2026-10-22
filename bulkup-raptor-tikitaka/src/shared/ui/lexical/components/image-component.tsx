/* eslint-disable react-hooks/set-state-in-effect -- editor node state mirrors Lexical node updates. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection'
import { mergeRegister } from '@lexical/utils'
import {
  $getNodeByKey,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  type NodeKey,
} from 'lexical'
import { $isImageNode, type ImageAlignment } from '../nodes/image-node'
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react'

type Props = {
  src: string
  altText: string
  width: number
  height: number
  alignment: ImageAlignment
  nodeKey: NodeKey
  editable: boolean
}

/**
 * Single component for both edit and view mode image rendering.
 * When `editable=false` we skip selection/resize/toolbar registration
 * so the DOM structure is identical across modes (only interactivity changes).
 */
export function ImageComponent({
  src,
  altText,
  width,
  height,
  alignment,
  nodeKey,
  editable,
}: Props) {
  const [editor] = useLexicalComposerContext()
  const imageRef = useRef<HTMLImageElement>(null)
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey)
  const [isResizing, setIsResizing] = useState(false)
  const [currentWidth, setCurrentWidth] = useState(width)
  const [currentHeight, setCurrentHeight] = useState(height)
  // [추가] 버튼 클릭 직후 화면 정렬을 즉시 반영한다.
  const [currentAlignment, setCurrentAlignment] = useState<ImageAlignment>(alignment)

  useEffect(() => {
    setCurrentWidth(width)
    setCurrentHeight(height)
    setCurrentAlignment(alignment)
  }, [width, height, alignment])

  // 편집 가능할 때만 커맨드 등록 (클릭 선택 / Delete / Backspace)
  useEffect(() => {
    if (!editable) return
    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (event: MouseEvent) => {
          if (imageRef.current && imageRef.current.contains(event.target as Node)) {
            if (!event.shiftKey) clearSelection()
            setSelected(true)
            return true
          }
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_DELETE_COMMAND,
        () => {
          if (isSelected) {
            editor.update(() => {
              const node = $getNodeByKey(nodeKey)
              if ($isImageNode(node)) node.remove()
            })
            return true
          }
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        () => {
          if (isSelected) {
            editor.update(() => {
              const node = $getNodeByKey(nodeKey)
              if ($isImageNode(node)) node.remove()
            })
            return true
          }
          return false
        },
        COMMAND_PRIORITY_LOW,
      ),
    )
  }, [editor, editable, isSelected, nodeKey, setSelected, clearSelection])

  // view 모드로 전환될 때 선택 상태 정리
  useEffect(() => {
    if (!editable && isSelected) clearSelection()
  }, [editable, isSelected, clearSelection])

  type ResizeDir = 'se' | 'sw' | 'ne' | 'nw'

  const handleResizeStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, dir: ResizeDir) => {
      if (!editable) return
      e.preventDefault()
      e.stopPropagation()

      setIsResizing(true)

      const startX = e.clientX
      const startY = e.clientY
      // [수정] 저장된 원본 폭이 컨테이너보다 큰 경우에도
      // 화면에 실제로 보이는 폭에서 드래그를 시작한다.
      const renderedRect = imageRef.current?.getBoundingClientRect()
      const startWidth =
        renderedRect?.width ||
        currentWidth ||
        imageRef.current?.naturalWidth ||
        300
      const startHeight =
        renderedRect?.height ||
        currentHeight ||
        imageRef.current?.naturalHeight ||
        200
      const aspectRatio = startWidth / (startHeight || 1)

      const xSign = dir === 'se' || dir === 'ne' ? 1 : -1
      const ySign = dir === 'se' || dir === 'sw' ? 1 : -1

      let latestWidth = startWidth
      let latestHeight = startHeight
      let finished = false

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (finished) return
        const deltaX = (moveEvent.clientX - startX) * xSign
        const deltaY = (moveEvent.clientY - startY) * ySign
        const newWidth = Math.max(50, startWidth + deltaX)
        const newHeight = moveEvent.shiftKey
          ? Math.max(50, startHeight + deltaY)
          : newWidth / aspectRatio

        latestWidth = Math.round(newWidth)
        latestHeight = Math.round(newHeight)
        setCurrentWidth(latestWidth)
        setCurrentHeight(latestHeight)

        // [추가] 화면 상태만 변경하지 않고 Lexical 노드에도 즉시 반영한다.
        // 포인터를 놓기 전에 저장해도 최신 크기가 editorState에 남는다.
        editor.update(() => {
          const node = $getNodeByKey(nodeKey)
          if ($isImageNode(node)) {
            node.setWidthAndHeight(latestWidth, latestHeight)
          }
        })
      }

      const cleanup = () => {
        document.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('pointerup', onPointerUp)
        document.removeEventListener('pointercancel', onPointerCancel)
      }

      const onPointerUp = () => {
        if (finished) return
        finished = true
        setIsResizing(false)
        cleanup()

        editor.update(() => {
          const node = $getNodeByKey(nodeKey)
          if ($isImageNode(node)) {
            node.setWidthAndHeight(latestWidth, latestHeight)
          }
        })
      }

      const onPointerCancel = () => {
        if (finished) return
        finished = true
        setIsResizing(false)
        cleanup()
      }

      // [수정] 포인터가 핸들 밖으로 빠져도 계속 리사이즈되도록
      // document에서 이동/종료 이벤트를 추적한다.
      document.addEventListener('pointermove', onPointerMove)
      document.addEventListener('pointerup', onPointerUp)
      document.addEventListener('pointercancel', onPointerCancel)
    },
    [editable, editor, nodeKey, currentWidth, currentHeight],
  )

  const handleAlignment = useCallback(
    (next: ImageAlignment) => {
      if (!editable) return
      // [추가] Lexical 업데이트와 동시에 화면 상태도 갱신
      setCurrentAlignment(next)
      editor.update(() => {
        const node = $getNodeByKey(nodeKey)
        if ($isImageNode(node)) node.setAlignment(next)
      })
    },
    [editable, editor, nodeKey],
  )

  // 정렬 래퍼는 항상 동일한 구조로 렌더 (view/edit 레이아웃 일관성 보장).
  // 외곽 div가 text-align으로 inline-block 자식을 정렬한다.
  const outerStyle: React.CSSProperties = {
    textAlign: currentAlignment,
    width: '100%',
    margin: '8px 0',
  }

  const innerStyle: React.CSSProperties = {
    display: 'inline-block',
    position: 'relative',
  }
  // [수정] 부모의 text-align이 left/center/right 정렬을 담당한다.
  // float와 auto margin을 사용하지 않아 정렬 상태가 충돌하지 않게 한다.

  const showSelectionChrome = editable && isSelected

  return (
    <div style={outerStyle}>
      <div style={innerStyle}>
        {/* Lexical supports data/blob URLs and user-provided loaders, so next/image is not suitable here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src={src}
          alt={altText}
          width={currentWidth || undefined}
          height={currentHeight || undefined}
          className={`max-w-full rounded-md ${
            showSelectionChrome ? 'ring-2 ring-brand-border' : ''
          } ${isResizing ? 'select-none' : ''}`}
          style={{
            display: 'block',
            // [추가] HTML width 속성과 함께 inline width를 지정해
            // 리사이즈 결과가 즉시 화면에 반영되도록 한다.
            width: currentWidth || undefined,
            height: currentHeight || undefined,
          }}
          draggable={false}
        />

        {showSelectionChrome ? (
          <>
            <div
              className="absolute top-0 left-0 w-5 h-5 bg-brand-primary cursor-nw-resize rounded-br"
              onPointerDown={(e) => handleResizeStart(e, 'nw')}
              onClick={(e) => e.stopPropagation()}
            />
            <div
              className="absolute top-0 right-0 w-5 h-5 bg-brand-primary cursor-ne-resize rounded-bl"
              onPointerDown={(e) => handleResizeStart(e, 'ne')}
              onClick={(e) => e.stopPropagation()}
            />
            <div
              className="absolute bottom-0 left-0 w-5 h-5 bg-brand-primary cursor-sw-resize rounded-tr"
              onPointerDown={(e) => handleResizeStart(e, 'sw')}
              onClick={(e) => e.stopPropagation()}
            />
            <div
              className="absolute bottom-0 right-0 w-5 h-5 bg-brand-primary cursor-se-resize rounded-tl"
              onPointerDown={(e) => handleResizeStart(e, 'se')}
              onClick={(e) => e.stopPropagation()}
            />
          </>
        ) : null}

        {showSelectionChrome ? (
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-surface-strong border border-surface-border rounded-md shadow-md px-1 py-0.5 z-10 backdrop-blur-sm">
            <AlignButton
              active={currentAlignment === 'left'}
              onClick={() => handleAlignment('left')}
              title="왼쪽 정렬"
            >
              <AlignLeft className="size-3.5" />
            </AlignButton>
            <AlignButton
              active={currentAlignment === 'center'}
              onClick={() => handleAlignment('center')}
              title="가운데 정렬"
            >
              <AlignCenter className="size-3.5" />
            </AlignButton>
            <AlignButton
              active={currentAlignment === 'right'}
              onClick={() => handleAlignment('right')}
              title="오른쪽 정렬"
            >
              <AlignRight className="size-3.5" />
            </AlignButton>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function AlignButton({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  active: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      // [수정] click보다 먼저 실행해 contenteditable 선택 변경을 방지한다.
      onMouseDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
      onClick={(event) => event.stopPropagation()}
      title={title}
      className={`p-1 rounded transition-colors ${
        active
          ? 'bg-brand-glass text-brand-primary'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted'
      }`}
    >
      {children}
    </button>
  )
}
