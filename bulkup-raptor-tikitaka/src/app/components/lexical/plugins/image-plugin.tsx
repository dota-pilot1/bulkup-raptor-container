import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $insertNodes,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  type LexicalCommand,
} from 'lexical'
import { $createImageNode, type ImagePayload } from '../nodes/image-node'

export const INSERT_IMAGE_COMMAND: LexicalCommand<ImagePayload> = createCommand(
  'INSERT_IMAGE_COMMAND',
)

export function ImagePlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerCommand<ImagePayload>(
      INSERT_IMAGE_COMMAND,
      (payload) => {
        const imageNode = $createImageNode(payload)
        $insertNodes([imageNode])
        return true
      },
      COMMAND_PRIORITY_EDITOR,
    )
  }, [editor])

  return null
}

export function DragDropImagePlugin({
  onUpload,
}: {
  onUpload: (file: File) => Promise<string>
}): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const rootElement = editor.getRootElement()
    if (!rootElement) return

    const handleDrop = async (e: DragEvent) => {
      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return
      const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
      if (imageFiles.length === 0) return

      e.preventDefault()
      for (const file of imageFiles) {
        try {
          const url = await onUpload(file)
          editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
            src: url,
            altText: file.name,
          })
        } catch (err) {
          console.error('Image upload failed:', err)
        }
      }
    }

    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault()
      }
    }

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of Array.from(items)) {
        if (!item.type.startsWith('image/')) continue
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue
        try {
          const url = await onUpload(file)
          editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
            src: url,
            altText: 'pasted-image',
          })
        } catch (err) {
          console.error('Image paste upload failed:', err)
        }
      }
    }

    rootElement.addEventListener('drop', handleDrop)
    rootElement.addEventListener('dragover', handleDragOver)
    rootElement.addEventListener('paste', handlePaste)

    return () => {
      rootElement.removeEventListener('drop', handleDrop)
      rootElement.removeEventListener('dragover', handleDragOver)
      rootElement.removeEventListener('paste', handlePaste)
    }
  }, [editor, onUpload])

  return null
}
