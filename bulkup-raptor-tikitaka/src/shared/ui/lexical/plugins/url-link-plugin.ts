import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $isCodeNode } from '@lexical/code'
import { $isLinkNode, $toggleLink } from '@lexical/link'
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_NORMAL,
  INSERT_PARAGRAPH_COMMAND,
  type LexicalEditor,
} from 'lexical'

// Listen to paragraph insertion rather than keydown: WebKit/Tauri may deliver
// Enter via beforeinput instead. Let Lexical perform the normal newline after us.
export function registerUrlLinkOnEnter(editor: LexicalEditor) {
  return editor.registerCommand(INSERT_PARAGRAPH_COMMAND, () => {
    if (!editor.isEditable() || editor.isComposing()) return false
    const selection = $getSelection()
    if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false
    const node = selection.anchor.getNode()
    if (!$isTextNode(node) || !node.isSimpleText() || node.hasFormat('code')) return false
    if (selection.anchor.offset !== node.getTextContentSize()) return false
    for (const ancestor of node.getParents()) {
      if ($isCodeNode(ancestor) || $isLinkNode(ancestor)) return false
    }

    const text = node.getTextContent()
    const match = /(?:^|\s)((?:https?:\/\/|www\.)[^\s<>]+)$/i.exec(text)
    if (!match) return false
    const label = match[1]
    const url = /^www\./i.test(label) ? `https://${label}` : label
    try {
      const parsed = new URL(url)
      if (!parsed.hostname || !['http:', 'https:'].includes(parsed.protocol)) return false
    } catch {
      return false
    }

    node.select(text.length - label.length, text.length)
    $toggleLink(url, { target: '_blank', rel: 'noopener noreferrer' })
    const linkedSelection = $getSelection()
    if ($isRangeSelection(linkedSelection)) {
      linkedSelection.anchor.set(
        linkedSelection.focus.key, linkedSelection.focus.offset, linkedSelection.focus.type,
      )
    }
    return false
  }, COMMAND_PRIORITY_NORMAL)
}

export function UrlLinkPlugin() {
  const [editor] = useLexicalComposerContext()
  useEffect(() => registerUrlLinkOnEnter(editor), [editor])
  return null
}
