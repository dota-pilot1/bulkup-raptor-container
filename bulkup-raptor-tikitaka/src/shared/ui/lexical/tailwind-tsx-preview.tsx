/* eslint-disable react-hooks/set-state-in-effect -- 다이얼로그가 열릴 때만 노드 값을 편집 초안으로 동기화한다. */
import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { CheckCircle2, Code2, ExternalLink, Monitor, Smartphone, X } from 'lucide-react'
import { UiCodeEditor } from '../code-editor'
import { CompactSelect } from '../compact-select'
import { ViewModeToggle } from '../view-mode-toggle'
import { compileTailwindTsxPreview } from './tailwind-tsx-runtime'

export type TailwindTsxBlock = {
  title: string
  source: string
  viewport: 'mobile' | 'tablet' | 'desktop' | 'responsive'
  theme: 'light' | 'dark'
}

export const DEFAULT_TAILWIND_TSX_SOURCE = `export default function Preview() {
  return (
    <button
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
      type="button"
    >
      저장
    </button>
  )
}`

function PreviewFrame({ source, viewport, theme, compact = false }: TailwindTsxBlock & { compact?: boolean }) {
  const [srcDoc, setSrcDoc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      compileTailwindTsxPreview(source).then((result) => {
        if (!active) return
        if (result.ok) {
          setSrcDoc(result.srcDoc)
          setError(null)
        } else {
          setError(result.message)
        }
      })
    }, compact ? 0 : 350)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [compact, source])

  const width = viewport === 'mobile' ? 'max-w-[390px]' : viewport === 'tablet' ? 'max-w-[768px]' : 'max-w-none'
  return (
    <div className={`flex min-h-0 flex-1 overflow-auto bg-slate-200/70 p-4 ${theme === 'dark' ? 'bg-slate-950' : ''}`}>
      <div className={`mx-auto min-h-[220px] w-full overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm ${width}`}>
        {srcDoc ? <iframe title="Tailwind TSX 미리보기" sandbox="allow-scripts" srcDoc={srcDoc} className="h-full min-h-[220px] w-full border-0 bg-slate-50" /> : null}
        {error ? <div className="grid min-h-[220px] place-items-center p-5 text-center"><div><p className="font-black text-red-700">미리보기를 만들 수 없습니다.</p><p className="mt-2 max-w-md whitespace-pre-wrap font-mono text-xs leading-5 text-red-600">{error}</p></div></div> : null}
      </div>
    </div>
  )
}

type WorkbenchProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: Partial<TailwindTsxBlock>
  onSave: (block: TailwindTsxBlock) => void
  actionLabel?: string
}

export function TailwindTsxWorkbenchDialog({ open, onOpenChange, initial, onSave, actionLabel = '삽입' }: WorkbenchProps) {
  const [title, setTitle] = useState(initial?.title ?? '새 Tailwind TSX 컴포넌트')
  const [source, setSource] = useState(initial?.source ?? DEFAULT_TAILWIND_TSX_SOURCE)
  const [viewport, setViewport] = useState<TailwindTsxBlock['viewport']>(initial?.viewport ?? 'desktop')
  const [theme, setTheme] = useState<TailwindTsxBlock['theme']>(initial?.theme ?? 'light')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTitle(initial?.title ?? '새 Tailwind TSX 컴포넌트')
    setSource(initial?.source ?? DEFAULT_TAILWIND_TSX_SOURCE)
    setViewport(initial?.viewport ?? 'desktop')
    setTheme(initial?.theme ?? 'light')
  }, [initial, open])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      compileTailwindTsxPreview(source).then((result) => setError(result.ok ? null : result.message))
    }, 350)
    return () => window.clearTimeout(timer)
  }, [source])

  const save = () => {
    if (!title.trim() || error) return
    onSave({ title: title.trim(), source, viewport, theme })
    onOpenChange(false)
  }

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return
      event.preventDefault()
      save()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  // save changes with the editable draft; rebind only while the dialog is visible.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, title, source, viewport, theme, error])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[260] bg-black/45" />
        <Dialog.Content className="fixed inset-3 z-[261] flex min-h-0 flex-col overflow-hidden rounded-xl border border-surface-border-soft bg-surface-raised shadow-2xl md:inset-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border-soft px-5 py-3">
            <div className="min-w-0">
              <Dialog.Title className="flex items-center gap-2 text-base font-black text-text-primary"><Code2 className="size-4 text-brand-primary" />Tailwind TSX 컴포넌트</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-text-muted">외부 import 없이 작성한 단일 컴포넌트를 격리된 로컬 미리보기로 확인합니다.</Dialog.Description>
            </div>
            <Dialog.Close asChild><button type="button" className="grid size-8 place-items-center rounded-md text-text-secondary hover:bg-surface-muted" aria-label="닫기"><X className="size-4" /></button></Dialog.Close>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-surface-border-soft bg-surface-muted/60 px-5 py-2.5">
            <label className="flex min-w-[220px] flex-1 items-center gap-2 text-xs font-black text-text-secondary">샘플명<input value={title} onChange={(event) => setTitle(event.target.value)} className="h-8 min-w-0 flex-1 rounded-md border border-surface-border bg-surface-raised px-2.5 text-[13px] font-bold text-text-primary outline-none focus:border-brand-primary" /></label>
            <label className="flex items-center gap-1.5 text-xs font-black text-text-secondary"><Monitor className="size-3.5" /><CompactSelect value={viewport} onChange={(event) => setViewport(event.target.value as TailwindTsxBlock['viewport'])} className="h-8 min-h-8 py-0 text-[12px] font-bold" wrapperClassName="w-[112px]"><option value="desktop">Desktop</option><option value="tablet">Tablet</option><option value="mobile">Mobile</option><option value="responsive">Responsive</option></CompactSelect></label>
            <label className="flex items-center gap-1.5 text-xs font-black text-text-secondary"><Smartphone className="size-3.5" /><CompactSelect value={theme} onChange={(event) => setTheme(event.target.value as TailwindTsxBlock['theme'])} className="h-8 min-h-8 py-0 text-[12px] font-bold" wrapperClassName="w-[86px]"><option value="light">Light</option><option value="dark">Dark</option></CompactSelect></label>
          </div>

          <div className="grid min-h-0 flex-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1">
            <section className="flex min-h-0 flex-col border-b border-surface-border-soft md:border-b-0 md:border-r">
              <div className="flex items-center justify-between border-b border-surface-border-soft bg-slate-800 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-slate-200"><span>TSX 코드 · CodeMirror</span><span className="normal-case tracking-normal text-slate-400">literal className만 Tailwind 생성</span></div>
              <UiCodeEditor value={source} onChange={setSource} diagnostics={error} />
            </section>
            <section className="flex min-h-0 flex-col"><div className="flex items-center gap-2 border-b border-surface-border-soft bg-surface-muted px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-text-secondary"><ExternalLink className="size-3.5" />격리된 미리보기</div><PreviewFrame title={title} source={source} viewport={viewport} theme={theme} /></section>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-surface-border-soft bg-surface-muted/60 px-5 py-3"><span className="text-xs font-semibold text-text-muted">{error ? '오류를 해결하면 저장할 수 있습니다.' : '정상 컴파일됨 · Cmd/Ctrl + S로 저장할 수 있습니다.'}</span><div className="flex gap-2"><button type="button" onClick={() => setSource(DEFAULT_TAILWIND_TSX_SOURCE)} className="ui-icon-button h-9 px-3 text-xs font-black">초기화</button><button type="button" onClick={save} disabled={!title.trim() || Boolean(error)} className="ui-icon-button-brand h-9 px-4 text-xs font-black disabled:opacity-40"><CheckCircle2 className="mr-1 inline size-3.5" />{actionLabel}</button></div></div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function TailwindTsxPreviewCard({ block, onUpdate, onDelete }: { block: TailwindTsxBlock; onUpdate?: (next: TailwindTsxBlock) => void; onDelete?: () => void }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'preview' | 'code'>('preview')
  return <div className="overflow-hidden rounded-lg border border-surface-border-soft bg-surface-raised"><div className="flex h-12 items-center justify-between gap-3 border-b border-surface-border-soft px-4"><div className="flex min-w-0 items-center gap-2"><span className="truncate text-[13px] font-black leading-none text-text-primary">{block.title}</span><span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-black leading-none text-text-muted">문서 TSX 샘플</span></div><div className="flex shrink-0 items-center gap-3"><ViewModeToggle value={view} onChange={setView} ariaLabel="컴포넌트 표시 방식" items={[{ value: 'preview', label: '미리보기', icon: Monitor }, { value: 'code', label: '코드', icon: Code2 }]} />{onUpdate ? <button type="button" onClick={() => setOpen(true)} className="text-xs font-black text-brand-primary hover:underline">편집</button> : null}{onDelete ? <button type="button" onClick={onDelete} className="text-xs font-black text-destructive hover:underline">삭제</button> : null}</div></div><div key={view} className="tailwind-tsx-view-enter">{view === 'preview' ? <PreviewFrame {...block} compact /> : <div className="tailwind-tsx-code-panel bg-[#282c34]"><UiCodeEditor value={block.source} onChange={() => undefined} readOnly /></div>}</div>{onUpdate ? <TailwindTsxWorkbenchDialog open={open} onOpenChange={setOpen} initial={block} actionLabel="업데이트" onSave={onUpdate} /> : null}</div>
}
