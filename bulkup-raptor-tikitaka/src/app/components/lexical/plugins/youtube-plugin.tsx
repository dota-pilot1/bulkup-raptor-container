import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $insertNodes,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  type LexicalCommand,
} from 'lexical'
import { $createYoutubeNode, type YoutubePayload } from '../nodes/youtube-node'

export const INSERT_YOUTUBE_COMMAND: LexicalCommand<YoutubePayload> = createCommand(
  'INSERT_YOUTUBE_COMMAND',
)

export function YoutubePlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerCommand<YoutubePayload>(
      INSERT_YOUTUBE_COMMAND,
      (payload) => {
        const node = $createYoutubeNode(payload)
        $insertNodes([node])
        return true
      },
      COMMAND_PRIORITY_EDITOR,
    )
  }, [editor])

  return null
}
