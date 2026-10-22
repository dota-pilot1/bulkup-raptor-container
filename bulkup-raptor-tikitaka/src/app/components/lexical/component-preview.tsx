import { useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Check, ChevronDown, Clipboard, X } from 'lucide-react'
import { findGalleryEntry, getGallerySource, type GalleryControl } from '../gallery/registry'
import { copyToClipboard } from '../../lib/clipboard'
import { codeLanguageOf, highlightCode } from './code-tokens'

export type ComponentPreviewBlock = {
  componentId: string
  props: Record<string, unknown>
}

const CONTROL_BASE =
  'h-8 rounded-md border border-surface-border bg-surface-raised px-2.5 text-[12.5px] font-bold text-text-primary outline-none transition-colors focus:border-brand-primary'

function ControlField({
  control,
  value,
  onChange,
}: {
  control: GalleryControl
  value: unknown
  onChange: (next: unknown) => void
}) {
  const label = <span className="text-[12.5px] font-black text-text-muted">{control.name}</span>

  if (control.type === 'select') {
    return (
      <label className="flex h-8 items-center gap-1.5">
        {label}
        {/* 기본 select 화살표가 OS마다 달라 보여서 직접 그린다. */}
        <span className="relative inline-flex items-center">
          <select
            value={String(value ?? '')}
            onChange={(event) => onChange(event.target.value)}
            className={`${CONTROL_BASE} appearance-none pr-7`}
          >
            {control.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-text-muted" />
        </span>
      </label>
    )
  }

  if (control.type === 'number') {
    return (
      <label className="flex h-8 items-center gap-1.5">
        {label}
        <input
          type="number"
          min={control.min}
          max={control.max}
          value={Number(value ?? 0)}
          onChange={(event) => onChange(Number(event.target.value))}
          className={`${CONTROL_BASE} w-16`}
        />
      </label>
    )
  }

  if (control.type === 'boolean') {
    const checked = Boolean(value)
    return (
      <label className="flex h-8 cursor-pointer items-center gap-1.5">
        {label}
        {/* 네이티브 체크박스는 OS마다 크기와 색이 달라 다른 컨트롤과 안 맞는다. */}
        <span className="relative inline-flex size-[18px] items-center justify-center">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            className="peer size-[18px] cursor-pointer appearance-none rounded-[5px] border border-surface-border bg-surface-raised transition-colors checked:border-brand-primary checked:bg-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-primary"
          />
          {checked ? (
            <Check className="pointer-events-none absolute size-3 text-text-on-brand" strokeWidth={3.5} />
          ) : null}
        </span>
      </label>
    )
  }

  return (
    <label className="flex h-8 items-center gap-1.5">
      {label}
      <input
        value={String(value ?? '')}
        onChange={(event) => onChange(event.target.value)}
        className={`${CONTROL_BASE} w-36`}
      />
    </label>
  )
}

/**
 * 레지스트리에 등록된 실제 컴포넌트를 그대로 렌더한다.
 * 코드 문자열을 컴파일하지 않으므로 임의 코드가 실행될 일이 없다.
 */
export function ComponentPreview({ block, framed = true }: { block: ComponentPreviewBlock; framed?: boolean }) {
  const entry = findGalleryEntry(block.componentId)
  const [props, setProps] = useState<Record<string, unknown>>(() => ({
    ...(entry?.defaultProps ?? {}),
    ...block.props,
  }))
  const [sourceOpen, setSourceOpen] = useState(false)
  // 파일이 여러 개인 컴포넌트가 있어 탭으로 고른다. 열 때마다 첫 파일부터 보여 준다.
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'failed'>('idle')

  const sources = useMemo(
    () => (entry?.sourceFiles ?? []).map((file) => ({ file, code: getGallerySource(file) })),
    [entry],
  )

  if (!entry) {
    return (
      <div className="rounded-md border border-dashed border-surface-border bg-surface-muted px-4 py-6 text-center text-[13px] font-bold text-text-muted">
        갤러리에 없는 컴포넌트입니다: <code>{block.componentId}</code>
      </div>
    )
  }

  const { Component } = entry
  const shownSource = sources.find((source) => source.file === activeFile) ?? sources[0]

  const handleCopy = async () => {
    if (!shownSource) return
    try {
      await copyToClipboard(shownSource.code)
      setCopyState('done')
    } catch {
      // 클립보드가 막힌 환경도 있다. 조용히 넘어가면 눌렀는데 아무 일도 안 난 것처럼 보이므로 알린다.
      setCopyState('failed')
    }
    window.setTimeout(() => setCopyState('idle'), 1500)
  }

  return (
    <div className={`gallery-preview ${framed ? "overflow-visible rounded-lg border border-surface-border-soft bg-surface-raised" : "bg-surface-raised"}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-surface-border-soft px-4 py-2.5">
        <span className="text-[14px] font-black text-text-primary">{entry.label}</span>
        {entry.controls.map((control) => (
          <ControlField
            key={control.name}
            control={control}
            value={props[control.name]}
            onChange={(next) => setProps((current) => ({ ...current, [control.name]: next }))}
          />
        ))}
        <button
          type="button"
          onClick={() => {
            setActiveFile(sources[0]?.file ?? null)
            setSourceOpen(true)
          }}
          className="ml-auto text-[12.5px] font-black text-brand-primary hover:underline"
        >
          소스 보기
        </button>
      </div>

      <div className="grid min-h-[104px] place-items-center bg-surface-muted p-5">
        <Component {...props} />
      </div>

      <Dialog.Root open={sourceOpen} onOpenChange={setSourceOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[240] bg-black/35" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[241] flex max-h-[calc(100vh-2rem)] w-[min(1080px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-surface-border-soft bg-surface-raised shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-surface-border-soft px-5 py-4">
              <div className="min-w-0">
                <Dialog.Title className="text-base font-semibold text-text-primary">
                  {entry.label} 소스
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-text-muted">
                  갤러리 파일을 그대로 읽어옵니다. 위 미리보기와 같은 코드입니다.
                </Dialog.Description>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex h-8 items-center gap-1.5 rounded-md border border-surface-border-soft px-2.5 text-[12.5px] font-bold text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
                >
                  {copyState === 'done' ? <Check className="size-3.5" /> : <Clipboard className="size-3.5" />}
                  {copyState === 'done' ? '복사됨' : copyState === 'failed' ? '복사 실패' : '복사'}
                </button>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="flex size-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
                    aria-label="닫기"
                  >
                    <X className="size-4" />
                  </button>
                </Dialog.Close>
              </div>
            </div>

            {sources.length > 1 && (
              <div className="flex shrink-0 gap-1 border-b border-surface-border-soft px-5 py-2">
                {sources.map((source) => (
                  <button
                    key={source.file}
                    type="button"
                    onClick={() => {
                      setActiveFile(source.file)
                      setCopyState('idle')
                    }}
                    aria-pressed={source.file === activeFile}
                    className={
                      'rounded-md px-3 py-1.5 font-mono text-[12px] font-black transition-colors ' +
                      (source.file === activeFile
                        ? 'bg-brand-primary text-text-on-brand'
                        : 'text-text-secondary hover:bg-surface-muted')
                    }
                  >
                    {source.file}
                  </button>
                ))}
              </div>
            )}

            <pre className="min-h-0 flex-1 overflow-auto bg-surface-muted px-5 py-4 font-mono text-[12.5px] leading-6 text-text-primary">
              {shownSource ? highlightCode(shownSource.code, codeLanguageOf(shownSource.file)) : null}
            </pre>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
