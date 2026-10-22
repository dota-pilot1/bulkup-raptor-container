import { useEffect } from 'react'
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
import { X } from 'lucide-react'
import { $isYoutubeNode } from '../nodes/youtube-node'

type Props = {
  videoId: string
  nodeKey: NodeKey
  editable: boolean
}

export function YoutubeComponent({ videoId, nodeKey, editable }: Props) {
  const [editor] = useLexicalComposerContext()
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey)

  useEffect(() => {
    if (!editable) return
    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (event: MouseEvent) => {
          const target = event.target as HTMLElement
          if (target?.dataset?.youtubeKey === nodeKey) {
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
          if (!isSelected) return false
          editor.update(() => {
            const node = $getNodeByKey(nodeKey)
            if ($isYoutubeNode(node)) node.remove()
          })
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        () => {
          if (!isSelected) return false
          editor.update(() => {
            const node = $getNodeByKey(nodeKey)
            if ($isYoutubeNode(node)) node.remove()
          })
          return true
        },
        COMMAND_PRIORITY_LOW,
      ),
    )
  }, [editor, editable, isSelected, nodeKey, setSelected, clearSelection])

  useEffect(() => {
    if (!editable && isSelected) clearSelection()
  }, [editable, isSelected, clearSelection])

  const handleRemove = () => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      if ($isYoutubeNode(node)) node.remove()
    })
  }

  const showChrome = editable && isSelected

  return (
    <div className="my-2 text-center" data-youtube-key={nodeKey}>
      <div
        data-youtube-key={nodeKey}
        className={`relative inline-block w-full max-w-[720px] ${
          showChrome ? 'rounded-md ring-2 ring-brand-border' : ''
        }`}
      >
        <iframe
          data-youtube-key={nodeKey}
          src={`https://www.youtube.com/embed/${videoId}`}
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          className="block aspect-video w-full rounded-lg border-0"
          style={{ pointerEvents: showChrome ? 'none' : 'auto' }}
        />

        {editable ? (
          <button
            type="button"
            onClick={handleRemove}
            title="삭제"
            className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-surface-raised text-text-primary shadow-sm ring-1 ring-surface-border-soft transition-colors hover:bg-surface-muted"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
