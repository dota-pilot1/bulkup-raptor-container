import { Suspense, lazy } from 'react'
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

export type ImageAlignment = 'left' | 'center' | 'right'

export type ImagePayload = {
  src: string
  altText: string
  width?: number
  height?: number
  alignment?: ImageAlignment
  key?: NodeKey
}

export type SerializedImageNode = Spread<
  {
    src: string
    altText: string
    width: number
    height: number
    alignment: ImageAlignment
  },
  SerializedLexicalNode
>

function convertImageElement(domNode: Node): DOMConversionOutput | null {
  if (domNode instanceof HTMLImageElement) {
    const src = domNode.getAttribute('src')
    const altText = domNode.getAttribute('alt') || ''
    if (src) {
      const node = $createImageNode({
        src,
        altText,
        width: domNode.width || 0,
        height: domNode.height || 0,
      })
      return { node }
    }
  }
  return null
}

export class ImageNode extends DecoratorNode<ReactElement> {
  __src: string
  __altText: string
  __width: number
  __height: number
  __alignment: ImageAlignment

  static getType(): string {
    return 'image'
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__src,
      node.__altText,
      node.__width,
      node.__height,
      node.__alignment,
      node.__key,
    )
  }

  constructor(
    src: string,
    altText: string,
    width?: number,
    height?: number,
    alignment?: ImageAlignment,
    key?: NodeKey,
  ) {
    super(key)
    this.__src = src
    this.__altText = altText
    this.__width = width || 0
    this.__height = height || 0
    this.__alignment = alignment || 'center'
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    return $createImageNode({
      src: serializedNode.src,
      altText: serializedNode.altText,
      width: serializedNode.width,
      height: serializedNode.height,
      alignment: serializedNode.alignment,
    })
  }

  exportJSON(): SerializedImageNode {
    return {
      type: 'image',
      version: 1,
      src: this.__src,
      altText: this.__altText,
      width: this.__width,
      height: this.__height,
      alignment: this.__alignment,
    }
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: () => ({
        conversion: convertImageElement,
        priority: 0,
      }),
    }
  }

  exportDOM(): DOMExportOutput {
    const img = document.createElement('img')
    img.setAttribute('src', this.__src)
    img.setAttribute('alt', this.__altText)
    if (this.__width) img.setAttribute('width', String(this.__width))
    if (this.__height) img.setAttribute('height', String(this.__height))
    img.style.maxWidth = '100%'

    const wrapper = document.createElement('div')
    wrapper.style.textAlign = this.__alignment
    wrapper.appendChild(img)
    return { element: wrapper }
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const div = document.createElement('div')
    div.style.textAlign = this.__alignment
    div.style.margin = '8px 0'
    return div
  }

  updateDOM(prevNode: ImageNode, dom: HTMLElement): boolean {
    if (prevNode.__alignment !== this.__alignment) {
      dom.style.textAlign = this.__alignment
    }
    return false
  }

  setWidthAndHeight(width: number, height: number): void {
    const writable = this.getWritable()
    writable.__width = width
    writable.__height = height
  }

  setAlignment(alignment: ImageAlignment): void {
    const writable = this.getWritable()
    writable.__alignment = alignment
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): ReactElement {
    return (
      <ImageDecorator
        src={this.__src}
        altText={this.__altText}
        width={this.__width}
        height={this.__height}
        alignment={this.__alignment}
        nodeKey={this.__key}
        editable={_editor.isEditable()}
      />
    )
  }
}

const LazyImageComponent = lazy(() =>
  import('../components/image-component').then((mod) => ({
    default: mod.ImageComponent,
  })),
)

function ImageDecorator({
  src,
  altText,
  width,
  height,
  alignment,
  nodeKey,
  editable,
}: {
  src: string
  altText: string
  width: number
  height: number
  alignment: ImageAlignment
  nodeKey: NodeKey
  editable: boolean
}) {
  return (
    <Suspense fallback={null}>
      <LazyImageComponent
        src={src}
        altText={altText}
        width={width}
        height={height}
        alignment={alignment}
        nodeKey={nodeKey}
        editable={editable}
      />
    </Suspense>
  )
}

export function $createImageNode(payload: ImagePayload): ImageNode {
  return $applyNodeReplacement(
    new ImageNode(
      payload.src,
      payload.altText,
      payload.width,
      payload.height,
      payload.alignment,
      payload.key,
    ),
  )
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode
}
