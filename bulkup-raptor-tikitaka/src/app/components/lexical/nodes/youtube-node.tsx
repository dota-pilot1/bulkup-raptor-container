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

export type YoutubePayload = {
  videoId: string
  key?: NodeKey
}

export type SerializedYoutubeNode = Spread<
  { videoId: string },
  SerializedLexicalNode
>

const EMBED_PREFIX = 'https://www.youtube.com/embed/'

function convertYoutubeElement(domNode: Node): DOMConversionOutput | null {
  if (domNode instanceof HTMLIFrameElement) {
    const src = domNode.getAttribute('src') ?? ''
    const match = src.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/)
    if (match) {
      return { node: $createYoutubeNode({ videoId: match[1] }) }
    }
  }
  return null
}

export class YoutubeNode extends DecoratorNode<ReactElement> {
  __videoId: string

  static getType(): string {
    return 'youtube'
  }

  static clone(node: YoutubeNode): YoutubeNode {
    return new YoutubeNode(node.__videoId, node.__key)
  }

  constructor(videoId: string, key?: NodeKey) {
    super(key)
    this.__videoId = videoId
  }

  static importJSON(serializedNode: SerializedYoutubeNode): YoutubeNode {
    return $createYoutubeNode({ videoId: serializedNode.videoId })
  }

  exportJSON(): SerializedYoutubeNode {
    return {
      type: 'youtube',
      version: 1,
      videoId: this.__videoId,
    }
  }

  static importDOM(): DOMConversionMap | null {
    return {
      iframe: (node: HTMLElement) => {
        const src = node.getAttribute('src') ?? ''
        if (!src.includes('youtube.com/embed/')) return null
        return { conversion: convertYoutubeElement, priority: 0 }
      },
    }
  }

  exportDOM(): DOMExportOutput {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('src', `${EMBED_PREFIX}${this.__videoId}`)
    iframe.setAttribute('frameborder', '0')
    iframe.setAttribute(
      'allow',
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
    )
    iframe.setAttribute('allowfullscreen', 'true')
    iframe.setAttribute('loading', 'lazy')
    iframe.style.aspectRatio = '16 / 9'
    iframe.style.width = '100%'
    iframe.style.maxWidth = '720px'
    iframe.style.border = '0'
    iframe.style.borderRadius = '8px'

    const wrapper = document.createElement('div')
    wrapper.style.textAlign = 'center'
    wrapper.style.margin = '8px 0'
    wrapper.appendChild(iframe)
    return { element: wrapper }
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const div = document.createElement('div')
    div.style.textAlign = 'center'
    div.style.margin = '8px 0'
    return div
  }

  updateDOM(): boolean {
    return false
  }

  decorate(_editor: LexicalEditor): ReactElement {
    return (
      <YoutubeDecorator
        videoId={this.__videoId}
        nodeKey={this.__key}
        editable={_editor.isEditable()}
      />
    )
  }
}

const LazyYoutubeComponent = lazy(() =>
  import('../components/youtube-component').then((mod) => ({
    default: mod.YoutubeComponent,
  })),
)

function YoutubeDecorator({
  videoId,
  nodeKey,
  editable,
}: {
  videoId: string
  nodeKey: NodeKey
  editable: boolean
}) {
  return (
    <Suspense fallback={null}>
      <LazyYoutubeComponent videoId={videoId} nodeKey={nodeKey} editable={editable} />
    </Suspense>
  )
}

export function $createYoutubeNode(payload: YoutubePayload): YoutubeNode {
  return $applyNodeReplacement(new YoutubeNode(payload.videoId, payload.key))
}

export function $isYoutubeNode(node: LexicalNode | null | undefined): node is YoutubeNode {
  return node instanceof YoutubeNode
}

export function extractYouTubeId(url: string): string | null {
  const trimmed = url.trim()
  const match = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  )
  return match?.[1] ?? null
}
