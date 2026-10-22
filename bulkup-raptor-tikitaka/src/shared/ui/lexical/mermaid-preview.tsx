import { Hand, Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'

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
  const [fullViewOpen, setFullViewOpen] = useState(false)
  const [fullViewButtonHovered, setFullViewButtonHovered] = useState(false)
  const [fullViewCloseHovered, setFullViewCloseHovered] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [panEnabled, setPanEnabled] = useState(false)
  const [spacePanActive, setSpacePanActive] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

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

  useEffect(() => {
    if (!fullViewOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFullViewOpen(false)
        return
      }
      if (event.code === 'Space') {
        event.preventDefault()
        setSpacePanActive(true)
      }
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpacePanActive(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    closeButtonRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [fullViewOpen])

  const openFullView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setPanEnabled(false)
    setSpacePanActive(false)
    setFullViewOpen(true)
  }

  const panActive = panEnabled || spacePanActive

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

  const fullViewButtonStyle: CSSProperties = {
    position: 'absolute',
    top: '0.5rem',
    right: '0.5rem',
    zIndex: 10,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    border: `1px solid ${fullViewButtonHovered ? 'var(--primary)' : 'var(--border)'}`,
    borderRadius: '0.375rem',
    background: fullViewButtonHovered ? 'var(--muted)' : 'var(--card)',
    padding: '0.25rem 0.5rem',
    color: fullViewButtonHovered ? 'var(--primary)' : 'var(--muted-foreground)',
    fontSize: '11px',
    fontWeight: 700,
    lineHeight: 1.25,
    boxShadow: fullViewButtonHovered
      ? '0 2px 6px rgb(5 150 105 / 18%)'
      : '0 1px 2px rgb(15 23 42 / 10%)',
    cursor: 'pointer',
    transition: 'background-color 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease',
  }
  const fullscreenBackdropStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'grid',
    placeItems: 'center',
    background: 'rgb(15 23 42 / 72%)',
    padding: '1.5rem',
  }
  const fullscreenPanelStyle: CSSProperties = {
    display: 'flex',
    width: 'min(96vw, 1800px)',
    height: 'min(90vh, 1080px)',
    minHeight: '420px',
    flexDirection: 'column',
    overflow: 'hidden',
    border: '1px solid var(--border)',
    borderRadius: '0.875rem',
    background: 'var(--card)',
    boxShadow: '0 24px 80px rgb(15 23 42 / 35%)',
  }
  const fullscreenHeaderStyle: CSSProperties = {
    display: 'flex',
    minHeight: '4.5rem',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    borderBottom: '1px solid color-mix(in srgb, var(--border) 65%, transparent)',
    padding: '0.75rem 1rem 0.75rem 1.25rem',
  }
  const fullscreenCloseStyle: CSSProperties = {
    display: 'grid',
    width: '2.25rem',
    height: '2.25rem',
    flex: '0 0 auto',
    placeItems: 'center',
    border: `1px solid ${fullViewCloseHovered ? 'var(--primary)' : 'var(--border)'}`,
    borderRadius: '0.5rem',
    background: fullViewCloseHovered ? 'var(--muted)' : 'var(--card)',
    color: fullViewCloseHovered ? 'var(--primary)' : 'var(--muted-foreground)',
    cursor: 'pointer',
  }
  const fullscreenStageStyle: CSSProperties = {
    minHeight: 0,
    flex: 1,
    overflow: 'auto',
    position: 'relative',
    background: 'color-mix(in srgb, var(--muted) 68%, var(--card))',
  }
  const fullscreenDiagramStyle: CSSProperties = {
    display: 'grid',
    minWidth: 'max-content',
    minHeight: '100%',
    placeItems: 'center',
    padding: '2.5rem',
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: 'center center',
    cursor: isDragging ? 'grabbing' : panActive ? 'grab' : 'default',
    transition: 'transform 120ms ease-out',
  }
  const controlButtonStyle: CSSProperties = {
    display: 'grid',
    width: '2rem',
    height: '2rem',
    placeItems: 'center',
    border: '1px solid var(--border)',
    borderRadius: '0.375rem',
    background: 'var(--card)',
    color: 'var(--foreground)',
    cursor: 'pointer',
  }
  const panControlStyle: CSSProperties = {
    ...controlButtonStyle,
    borderColor: panActive ? 'var(--primary)' : 'var(--border)',
    background: panActive ? 'color-mix(in srgb, var(--primary) 12%, var(--card))' : 'var(--card)',
    color: panActive ? 'var(--primary)' : 'var(--foreground)',
  }
  const zoomResetStyle: CSSProperties = {
    ...controlButtonStyle,
    width: '3.5rem',
    flex: '0 0 3.5rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  }

  const startPanning = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panActive || event.button !== 0) return
    event.preventDefault()
    dragStartRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const movePanning = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current
    if (!dragStart) return
    setPan({ x: dragStart.panX + event.clientX - dragStart.x, y: dragStart.panY + event.clientY - dragStart.y })
  }
  const endPanning = () => {
    dragStartRef.current = null
    setIsDragging(false)
  }

  return (
    <>
      <div
        className={`lexical-mermaid-preview${frame ? '' : ' lexical-mermaid-preview-flat'}`}
        style={{
          position: 'relative',
          // 전체 보기 버튼이 다이어그램의 첫 행을 가리지 않도록 버튼 영역을 확보한다.
          paddingTop: '3rem',
        }}
      >
        <button
          type="button"
          className="lexical-mermaid-full-view-button"
          onClick={openFullView}
          onMouseEnter={() => setFullViewButtonHovered(true)}
          onMouseLeave={() => setFullViewButtonHovered(false)}
          onFocus={() => setFullViewButtonHovered(true)}
          onBlur={() => setFullViewButtonHovered(false)}
          aria-label="Mermaid 다이어그램 전체 보기"
          title="전체 보기"
          style={fullViewButtonStyle}
        >
          <Maximize2 className="size-3.5" aria-hidden="true" />
          <span>전체 보기</span>
        </button>
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
      {fullViewOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="lexical-mermaid-fullscreen-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Mermaid 다이어그램 전체 보기"
          onMouseDown={() => setFullViewOpen(false)}
          style={fullscreenBackdropStyle}
        >
          <section
            className="lexical-mermaid-fullscreen-panel"
            onMouseDown={(event) => event.stopPropagation()}
            style={fullscreenPanelStyle}
          >
            <header className="lexical-mermaid-fullscreen-header" style={fullscreenHeaderStyle}>
              <div>
                <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: '0.6875rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Mermaid 다이어그램</p>
                <h2 style={{ margin: '0.125rem 0 0', color: 'var(--foreground)', fontSize: '1.125rem', fontWeight: 800 }}>전체 보기</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  aria-label="다이어그램 확대와 이동 도구"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', border: '1px solid var(--border)', borderRadius: '0.5rem', background: 'var(--card)', padding: '0.25rem', boxShadow: '0 2px 8px rgb(15 23 42 / 14%)' }}
                >
                  <button type="button" style={controlButtonStyle} onClick={() => setZoom((value) => Math.max(0.5, Number((value - 0.15).toFixed(2))))} aria-label="축소" title="축소">
                    <Minus className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" style={zoomResetStyle} onClick={() => setZoom(1)} aria-label="원래 크기" title="원래 크기">
                    {Math.round(zoom * 100)}%
                  </button>
                  <button type="button" style={controlButtonStyle} onClick={() => setZoom((value) => Math.min(2.5, Number((value + 0.15).toFixed(2))))} aria-label="확대" title="확대">
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" style={panControlStyle} onClick={() => setPanEnabled((value) => !value)} aria-label="손바닥 이동 도구" aria-pressed={panEnabled} title="손바닥 이동 · Space를 누른 채 드래그할 수도 있습니다">
                    <Hand className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" style={controlButtonStyle} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} aria-label="확대와 위치 초기화" title="초기화">
                    <RotateCcw className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  className="lexical-mermaid-fullscreen-close"
                  onClick={() => setFullViewOpen(false)}
                  onMouseEnter={() => setFullViewCloseHovered(true)}
                  onMouseLeave={() => setFullViewCloseHovered(false)}
                  onFocus={() => setFullViewCloseHovered(true)}
                  onBlur={() => setFullViewCloseHovered(false)}
                  aria-label="전체 보기 닫기"
                  title="닫기"
                  style={fullscreenCloseStyle}
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
            </header>
            <div
              className="lexical-mermaid-fullscreen-stage"
              style={fullscreenStageStyle}
              onPointerDown={startPanning}
              onPointerMove={movePanning}
              onPointerUp={endPanning}
              onPointerCancel={endPanning}
            >
              <div
                className="lexical-mermaid-fullscreen-diagram"
                dangerouslySetInnerHTML={{ __html: svg }}
                style={fullscreenDiagramStyle}
              />
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
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
