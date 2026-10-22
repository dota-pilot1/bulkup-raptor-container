import type { ReactElement } from 'react'
import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical'
import { DecoratorNode, $applyNodeReplacement } from 'lexical'
import { MermaidPreview } from '../mermaid-preview'

export type MermaidPayload = {
  source: string
  key?: NodeKey
}

export type SerializedMermaidNode = Spread<
  { source: string },
  SerializedLexicalNode
>

export class MermaidNode extends DecoratorNode<ReactElement> {
  __source: string

  static getType(): string {
    return 'mermaid'
  }

  static clone(node: MermaidNode): MermaidNode {
    return new MermaidNode(node.__source, node.__key)
  }

  constructor(source: string, key?: NodeKey) {
    super(key)
    this.__source = source
  }

  static importJSON(serializedNode: SerializedMermaidNode): MermaidNode {
    return $createMermaidNode({ source: serializedNode.source })
  }

  exportJSON(): SerializedMermaidNode {
    return {
      type: 'mermaid',
      version: 1,
      source: this.__source,
    }
  }

  static importDOM(): DOMConversionMap | null {
    return null
  }

  exportDOM(): DOMExportOutput {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-mermaid-source', this.__source)
    return { element: wrapper }
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const div = document.createElement('div')
    div.className = 'lexical-mermaid-node'
    return div
  }

  updateDOM(): boolean {
    return false
  }

  decorate(_editor: LexicalEditor): ReactElement {
    return <MermaidPreview block={{ id: this.__key, source: this.__source }} frame={false} index={0} />
  }
}

export function $createMermaidNode(payload: MermaidPayload): MermaidNode {
  return $applyNodeReplacement(new MermaidNode(payload.source, payload.key))
}

export function $isMermaidNode(node: LexicalNode | null | undefined): node is MermaidNode {
  return node instanceof MermaidNode
}
