const ALLOWED_TAGS = new Set([
  'ARTICLE', 'ASIDE', 'BUTTON', 'DIV', 'FORM', 'H1', 'H2', 'H3', 'HEADER',
  'INPUT', 'LABEL', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'SECTION', 'SMALL',
  'SPAN', 'STRONG', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR',
  'UL', 'BR',
])

const ALLOWED_ATTRIBUTES = new Set([
  'class', 'id', 'title', 'role', 'type', 'value', 'placeholder', 'disabled',
  'checked', 'colspan', 'rowspan', 'scope',
])

export function sanitizePreviewHtml(source: string): string {
  if (typeof DOMParser === 'undefined') return source

  const document = new DOMParser().parseFromString(source, 'text/html')
  const visit = (element: Element) => {
    Array.from(element.children).forEach((child) => {
      if (!ALLOWED_TAGS.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes))
        return
      }

      Array.from(child.attributes).forEach((attribute) => {
        const name = attribute.name.toLowerCase()
        if (!ALLOWED_ATTRIBUTES.has(name) && !name.startsWith('aria-') && !name.startsWith('data-')) {
          child.removeAttribute(attribute.name)
        }
      })
      visit(child)
    })
  }

  visit(document.body)
  return document.body.innerHTML
}

export function sanitizePreviewCss(source: string): string {
  return source
    .replace(/<\/?style[^>]*>/gi, '')
    .replace(/@import[^;]+;?/gi, '')
    .replace(/url\s*\([^)]*\)/gi, '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/behavior\s*:/gi, '')
}

