import { useMemo } from 'react'
import { sanitizePreviewCss, sanitizePreviewHtml } from './utils/html-preview-sanitizer'

export type HtmlPreviewBlock = {
  html: string
  css: string
}

export function HtmlPreview({ block }: { block: HtmlPreviewBlock }) {
  const srcDoc = useMemo(() => {
    const html = sanitizePreviewHtml(block.html)
    const css = sanitizePreviewCss(block.css)
    return `<!doctype html><html><head><meta charset="UTF-8"><style>
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; }
      body { padding: 20px; background: #f8fafc; color: #172033; font-family: Arial, sans-serif; }
      ${css}
    </style></head><body>${html}</body></html>`
  }, [block.css, block.html])

  return (
    <iframe
      title="HTML 화면 미리보기"
      sandbox=""
      srcDoc={srcDoc}
      className="h-[520px] w-full rounded-md border-0 bg-slate-50"
    />
  )
}

