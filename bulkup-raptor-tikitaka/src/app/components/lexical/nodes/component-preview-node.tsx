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
import { ComponentPreview } from '../component-preview'

export type ComponentPreviewPayload = {
  componentId: string
  props?: Record<string, unknown>
  key?: NodeKey
}

export type SerializedComponentPreviewNode = Spread<
  { componentId: string; props: Record<string, unknown> },
  SerializedLexicalNode
>

/**
 * 갤러리에 등록된 실제 컴포넌트를 가리키는 노드.
 * 코드가 아니라 id와 props만 저장하므로 본문이 가벼우며 렌더는 앱 코드가 맡는다.
 */
export class ComponentPreviewNode extends DecoratorNode<ReactElement> {
  __componentId: string
  __props: Record<string, unknown>

  static getType(): string {
    return 'component-preview'
  }

  static clone(node: ComponentPreviewNode): ComponentPreviewNode {
    return new ComponentPreviewNode(node.__componentId, node.__props, node.__key)
  }

  constructor(componentId: string, props: Record<string, unknown>, key?: NodeKey) {
    super(key)
    this.__componentId = componentId
    this.__props = props
  }

  static importJSON(serializedNode: SerializedComponentPreviewNode): ComponentPreviewNode {
    return $createComponentPreviewNode({
      componentId: serializedNode.componentId,
      props: serializedNode.props,
    })
  }

  exportJSON(): SerializedComponentPreviewNode {
    return {
      type: 'component-preview',
      version: 1,
      componentId: this.__componentId,
      props: this.__props,
    }
  }

  static importDOM(): DOMConversionMap | null {
    return null
  }

  exportDOM(): DOMExportOutput {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-component-preview', this.__componentId)
    return { element: wrapper }
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const div = document.createElement('div')
    div.className = 'lexical-component-preview-node'
    return div
  }

  updateDOM(): boolean {
    return false
  }

  decorate(_editor: LexicalEditor): ReactElement {
    return <ComponentPreview block={{ componentId: this.__componentId, props: this.__props }} />
  }
}

export function $createComponentPreviewNode(payload: ComponentPreviewPayload): ComponentPreviewNode {
  return $applyNodeReplacement(new ComponentPreviewNode(payload.componentId, payload.props ?? {}))
}

export function $isComponentPreviewNode(
  node: LexicalNode | null | undefined,
): node is ComponentPreviewNode {
  return node instanceof ComponentPreviewNode
}
