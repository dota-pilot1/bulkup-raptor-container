import { useEffect, useState } from 'react'

export type MermaidBlock = {
  id: string
  source: string
}

export function MermaidPreview({
  block,
  frame = true,
  index,
}: {
  block: MermaidBlock
  frame?: boolean
  index: number
}) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false

    async function render() {
      try {
        setError(null)
        setSvg(null)
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          themeVariables: {
            primaryColor: '#ffffff',
            primaryBorderColor: '#059669',
            primaryTextColor: '#111827',
            lineColor: '#374151',
            secondaryColor: '#f8fafc',
            secondaryBorderColor: '#94a3b8',
            secondaryTextColor: '#111827',
            tertiaryColor: '#ecfdf5',
            tertiaryBorderColor: '#059669',
            tertiaryTextColor: '#111827',
            fontFamily: 'Pretendard Variable, Pretendard, sans-serif',
          },
        })
        const id = `lexical-mermaid-${Date.now()}-${index}`
        const result = await mermaid.render(id, block.source)
        if (!disposed) setSvg(result.svg)
      } catch (renderError) {
        if (!disposed) {
          setError(
            renderError instanceof Error
              ? renderError.message
              : 'Mermaid 다이어그램을 렌더링하지 못했습니다.',
          )
        }
      }
    }

    void render()

    return () => {
      disposed = true
    }
  }, [block.source, index])

  if (error) {
    return (
      <div
        className={`lexical-mermaid-preview lexical-mermaid-preview-error${frame ? '' : ' lexical-mermaid-preview-flat'}`}
      >
        {error}
      </div>
    )
  }

  if (!svg) {
    return (
      <div
        className={`lexical-mermaid-preview${frame ? '' : ' lexical-mermaid-preview-flat'}`}
      >
        다이어그램 렌더링 중...
      </div>
    )
  }

  return (
    <div
      className={`lexical-mermaid-preview${frame ? '' : ' lexical-mermaid-preview-flat'}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export function MermaidPreviewList({ blocks }: { blocks: MermaidBlock[] }) {
  if (blocks.length === 0) return null

  return (
    <div className="border-t border-surface-border-soft px-5 py-4">
      <div className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-brand-primary">
        Mermaid Preview
      </div>
      <div className="space-y-3">
        {blocks.map((block, index) => (
          <MermaidPreview key={`${block.id}-${index}`} block={block} index={index} />
        ))}
      </div>
    </div>
  )
}
