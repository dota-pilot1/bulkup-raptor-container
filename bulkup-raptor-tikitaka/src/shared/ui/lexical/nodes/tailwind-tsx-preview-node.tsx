import type { ReactElement } from 'react'
import type { DOMConversionMap, DOMExportOutput, EditorConfig, LexicalEditor, LexicalNode, NodeKey, SerializedLexicalNode, Spread } from 'lexical'
import { $applyNodeReplacement, $getNodeByKey, DecoratorNode } from 'lexical'
import { TailwindTsxPreviewCard, type TailwindTsxBlock } from '../tailwind-tsx-preview'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'

// Lexical은 같은 type의 노드 생성자 identity가 달라지면 삽입을 막는다.
// 개발 중 Fast Refresh로 이 파일만 교체될 때 기존 Editor를 안전하게 재마운트하기 위한 키다.
export const TAILWIND_TSX_NODE_RUNTIME_KEY = `tailwind-tsx-${Math.random().toString(36).slice(2)}`

export type TailwindTsxPreviewPayload = TailwindTsxBlock & { key?: NodeKey }
export type SerializedTailwindTsxPreviewNode = Spread<TailwindTsxBlock, SerializedLexicalNode>

function TailwindTsxNodeView({ nodeKey, block }: { nodeKey: NodeKey; block: TailwindTsxBlock }) {
  const [editor] = useLexicalComposerContext()
  const update = editor.isEditable()
    ? (next: TailwindTsxBlock) => editor.update(() => { const node = $getNodeByKey(nodeKey); if ($isTailwindTsxPreviewNode(node)) node.setBlock(next) })
    : undefined
  const remove = editor.isEditable()
    ? () => editor.update(() => { const node = $getNodeByKey(nodeKey); if ($isTailwindTsxPreviewNode(node)) node.remove() })
    : undefined
  return <TailwindTsxPreviewCard block={block} onUpdate={update} onDelete={remove} />
}

export class TailwindTsxPreviewNode extends DecoratorNode<ReactElement> {
  __title: string
  __source: string
  __viewport: TailwindTsxBlock['viewport']
  __theme: TailwindTsxBlock['theme']

  static getType() { return 'tailwind-tsx-preview' }
  static clone(node: TailwindTsxPreviewNode) { return new TailwindTsxPreviewNode(node.getBlock(), node.__key) }
  constructor(block: TailwindTsxBlock, key?: NodeKey) { super(key); this.__title = block.title; this.__source = block.source; this.__viewport = block.viewport; this.__theme = block.theme }
  getBlock(): TailwindTsxBlock { return { title: this.__title, source: this.__source, viewport: this.__viewport, theme: this.__theme } }
  setBlock(block: TailwindTsxBlock) { const writable = this.getWritable(); writable.__title = block.title; writable.__source = block.source; writable.__viewport = block.viewport; writable.__theme = block.theme }
  static importJSON(serialized: SerializedTailwindTsxPreviewNode) { return $createTailwindTsxPreviewNode(serialized) }
  exportJSON(): SerializedTailwindTsxPreviewNode { return { type: 'tailwind-tsx-preview', version: 1, ...this.getBlock() } }
  static importDOM(): DOMConversionMap | null { return null }
  exportDOM(): DOMExportOutput { const element = document.createElement('div'); element.setAttribute('data-tailwind-tsx-preview', 'true'); return { element } }
  createDOM(_config: EditorConfig) { const div = document.createElement('div'); div.className = 'lexical-tailwind-tsx-preview-node'; return div }
  updateDOM() { return false }
  decorate(_editor: LexicalEditor) { return <TailwindTsxNodeView nodeKey={this.__key} block={this.getBlock()} /> }
}

export function $createTailwindTsxPreviewNode(payload: TailwindTsxPreviewPayload) { return $applyNodeReplacement(new TailwindTsxPreviewNode(payload, payload.key)) }
export function $isTailwindTsxPreviewNode(node: LexicalNode | null | undefined): node is TailwindTsxPreviewNode { return node instanceof TailwindTsxPreviewNode }
