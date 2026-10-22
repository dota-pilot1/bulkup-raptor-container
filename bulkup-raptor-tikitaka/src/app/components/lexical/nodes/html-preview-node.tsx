import type { ReactElement } from 'react'
import type {
  DOMConversionMap,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical'
import { DecoratorNode, $applyNodeReplacement } from 'lexical'
import { HtmlPreview } from '../html-preview'

export type HtmlPreviewPayload = {
  html: string
  css: string
  key?: NodeKey
}

export type SerializedHtmlPreviewNode = Spread<
  { html: string; css: string },
  SerializedLexicalNode
>

export class HtmlPreviewNode extends DecoratorNode<ReactElement> {
  __html: string
  __css: string

  static getType(): string {
    return 'html-preview'
  }

  static clone(node: HtmlPreviewNode): HtmlPreviewNode {
    return new HtmlPreviewNode(node.__html, node.__css, node.__key)
  }

  constructor(html: string, css: string, key?: NodeKey) {
    super(key)
    this.__html = html
    this.__css = css
  }

  static importJSON(serializedNode: SerializedHtmlPreviewNode): HtmlPreviewNode {
    return $createHtmlPreviewNode({ html: serializedNode.html, css: serializedNode.css })
  }

  exportJSON(): SerializedHtmlPreviewNode {
    return { type: 'html-preview', version: 1, html: this.__html, css: this.__css }
  }

  static importDOM(): DOMConversionMap | null {
    return null
  }

  exportDOM(): DOMExportOutput {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-html-preview', 'true')
    return { element: wrapper }
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const div = document.createElement('div')
    div.className = 'lexical-html-preview-node'
    return div
  }

  updateDOM(): boolean {
    return false
  }

  decorate(_editor: LexicalEditor): ReactElement {
    return <HtmlPreview block={{ html: this.__html, css: this.__css }} />
  }
}

export function $createHtmlPreviewNode(payload: HtmlPreviewPayload): HtmlPreviewNode {
  return $applyNodeReplacement(new HtmlPreviewNode(payload.html, payload.css, payload.key))
}

export function $isHtmlPreviewNode(node: LexicalNode | null | undefined): node is HtmlPreviewNode {
  return node instanceof HtmlPreviewNode
}

