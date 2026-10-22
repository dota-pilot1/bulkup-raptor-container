import { compile } from 'tailwindcss'
import { transform } from 'sucrase'

export type PreviewCompileResult =
  | { ok: true; srcDoc: string }
  | { ok: false; message: string }

// 자유 입력 소스는 Next 빌드 시 Tailwind content 스캔 대상이 아니다. 미리보기 안에서
// 필요한 유틸리티를 즉석 생성하기 위해, 샘플 컴포넌트에 필요한 기본 디자인 토큰을 둔다.
const PREVIEW_TAILWIND_THEME = `
@theme {
  --font-sans: ui-sans-serif, system-ui, sans-serif;
  --spacing: .25rem;
  --radius-sm: .125rem;
  --radius-md: .375rem;
  --radius-lg: .5rem;
  --radius-xl: .75rem;
  --text-xs: .75rem;
  --text-xs--line-height: 1rem;
  --text-sm: .875rem;
  --text-sm--line-height: 1.25rem;
  --text-base: 1rem;
  --text-base--line-height: 1.5rem;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --shadow-sm: 0 1px 2px 0 rgb(15 23 42 / .08);
  --shadow-md: 0 4px 10px -2px rgb(15 23 42 / .14);
  --color-white: #fff;
  --color-black: #000;
  --color-slate-50: #f8fafc;
  --color-slate-100: #f1f5f9;
  --color-slate-200: #e2e8f0;
  --color-slate-300: #cbd5e1;
  --color-slate-500: #64748b;
  --color-slate-600: #475569;
  --color-slate-700: #334155;
  --color-slate-900: #0f172a;
  --color-blue-50: #eff6ff;
  --color-blue-100: #dbeafe;
  --color-blue-500: #3b82f6;
  --color-blue-600: #2563eb;
  --color-blue-700: #1d4ed8;
  --color-green-100: #dcfce7;
  --color-green-600: #16a34a;
  --color-red-100: #fee2e2;
  --color-red-600: #dc2626;
  --color-amber-100: #fef3c7;
  --color-amber-600: #d97706;
}
@tailwind utilities;
`

let compilerPromise: ReturnType<typeof compile> | null = null

function getCompiler() {
  compilerPromise ??= compile(PREVIEW_TAILWIND_THEME)
  return compilerPromise
}

function extractCandidates(source: string): string[] {
  const candidates = new Set<string>()
  const literalPattern = /className\s*=\s*(["'`])([^"'`]+)\1/g
  let match: RegExpExecArray | null
  while ((match = literalPattern.exec(source))) {
    match[2].split(/\s+/).filter(Boolean).forEach((candidate) => candidates.add(candidate))
  }
  return [...candidates]
}

function validateSource(source: string): string | null {
  if (!/export\s+default\s+function\s+[A-Za-z_$][\w$]*/.test(source)) {
    return '`export default function Preview()` 형태의 컴포넌트를 작성하세요.'
  }
  if (/^\s*import\s/m.test(source)) return '1차 미리보기에서는 import를 사용할 수 없습니다.'
  if (/\b(?:eval|Function|fetch|WebSocket|XMLHttpRequest|localStorage|sessionStorage|window|document|globalThis|setInterval|setTimeout)\b/.test(source)) {
    return '브라우저 API·네트워크·타이머 접근은 샘플 미리보기에서 사용할 수 없습니다.'
  }
  if (/\b(?:while|for|do)\s*[({]/.test(source)) return '반복문은 미리보기 안정성을 위해 사용할 수 없습니다.'
  return null
}

function escapeScript(value: string) {
  return value.replace(/<\/script/gi, '<\\/script')
}

function makeSrcDoc(code: string, css: string) {
  // iframe은 opaque origin sandbox로 열려 부모 앱의 DOM, storage, Tauri API에 접근하지 못한다.
  return `<!doctype html><html><head><meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'none';" />
<style>*,::before,::after{box-sizing:border-box}html,body,#root{min-height:100%;margin:0}button,input,select,textarea{appearance:none;border:0;margin:0;padding:0;font:inherit;color:inherit;background:transparent}button{cursor:pointer}html,body,#root{min-height:100%}body{padding:24px;background:#f8fafc;color:#0f172a;font-family:ui-sans-serif,system-ui,sans-serif}${css}</style>
</head><body><div id="root"></div><script>
const Fragment = Symbol('Fragment');
function h(tag, props, ...children) { return { tag, props: props || {}, children: children.flat(Infinity) }; }
function setProps(element, props) {
  for (const [key, value] of Object.entries(props || {})) {
    if (key === 'children' || key === '__self' || key === '__source' || value == null || value === false) continue;
    if (key === 'className') { element.setAttribute('class', String(value)); continue; }
    if (key === 'style' && typeof value === 'object') { Object.assign(element.style, value); continue; }
    if (/^on[A-Z]/.test(key) && typeof value === 'function') { element.addEventListener(key.slice(2).toLowerCase(), value); continue; }
    if (value === true) { element.setAttribute(key, ''); continue; }
    element.setAttribute(key, String(value));
  }
}
function mount(vnode, parent) {
  if (vnode == null || vnode === false || vnode === true) return;
  if (typeof vnode === 'string' || typeof vnode === 'number') { parent.appendChild(document.createTextNode(String(vnode))); return; }
  if (Array.isArray(vnode)) { vnode.forEach((item) => mount(item, parent)); return; }
  if (vnode.tag === Fragment) { vnode.children.forEach((item) => mount(item, parent)); return; }
  if (typeof vnode.tag === 'function') { mount(vnode.tag({ ...vnode.props, children: vnode.children }), parent); return; }
  const element = document.createElement(vnode.tag);
  setProps(element, vnode.props);
  vnode.children.forEach((item) => mount(item, element));
  parent.appendChild(element);
}
try {
  const module = { exports: {} }; const exports = module.exports;
  ${escapeScript(code)}
  const PreviewComponent = module.exports.default || exports.default;
  if (typeof PreviewComponent !== 'function') throw new Error('default export 컴포넌트를 찾을 수 없습니다.');
  mount(h(PreviewComponent, {}), document.getElementById('root'));
} catch (error) {
  document.getElementById('root').innerHTML = '<pre style="white-space:pre-wrap;color:#b91c1c;font:600 13px/1.6 ui-monospace,monospace"></pre>';
  document.querySelector('pre').textContent = '렌더링 오류: ' + (error && error.message ? error.message : String(error));
}
</script></body></html>`
}

export async function compileTailwindTsxPreview(source: string): Promise<PreviewCompileResult> {
  const invalid = validateSource(source)
  if (invalid) return { ok: false, message: invalid }

  try {
    const transformed = transform(source, {
      transforms: ['typescript', 'jsx', 'imports'],
      jsxPragma: 'h',
      jsxFragmentPragma: 'Fragment',
      production: true,
    }).code
    const compiler = await getCompiler()
    const css = compiler.build(extractCandidates(source))
    return { ok: true, srcDoc: makeSrcDoc(transformed, css) }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'TSX를 변환하지 못했습니다.' }
  }
}
