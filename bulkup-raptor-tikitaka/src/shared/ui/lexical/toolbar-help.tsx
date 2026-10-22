import * as Dialog from '@radix-ui/react-dialog'
import { useId, useRef, useState } from 'react'
import { Button } from '../button'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, Blocks, Bold,
  CircleHelp, Code, Eraser, GitBranch, Heading1, Heading2, Heading3, Highlighter,
  Image, Italic, Link, List, ListChecks, ListOrdered, Minus, PanelTop, Quote,
  Redo, Strikethrough, Table, Underline, Undo, Video, X, type LucideIcon,
} from 'lucide-react'

type HelpItem = {
  title: string
  description: string
  icon?: LucideIcon
  label?: string
  fullOnly?: boolean
  imageOnly?: boolean
}

const HELP_GROUPS: { title: string; items: HelpItem[] }[] = [
  { title: '글자 서식', items: [
    { icon: Undo, title: '실행 취소', description: '방금 한 편집을 되돌립니다.' },
    { icon: Redo, title: '다시 실행', description: '취소했던 편집을 다시 적용합니다.' },
    { icon: Eraser, title: '서식 지우기', description: '선택한 영역의 글자·문단 서식을 지우고 일반 본문으로 되돌립니다.' },
    { label: 'Aa', title: '글씨체', description: '선택한 글자의 글꼴을 바꿉니다.', fullOnly: true },
    { label: '15', title: '글씨 크기', description: '선택한 글자의 크기를 바꿉니다.', fullOnly: true },
    { icon: Bold, title: '굵게', description: '선택한 글자를 굵게 표시합니다. ⌘/Ctrl+B' },
    { icon: Italic, title: '기울임', description: '선택한 글자를 기울입니다. ⌘/Ctrl+I' },
    { icon: Underline, title: '밑줄', description: '선택한 글자에 밑줄을 긋습니다. ⌘/Ctrl+U' },
    { icon: Strikethrough, title: '취소선', description: '글자 가운데 선을 긋습니다.', fullOnly: true },
    { icon: Code, title: '인라인 코드', description: '문장 속 함수명이나 짧은 코드를 표시합니다.', fullOnly: true },
    { icon: Baseline, title: '글씨 색상', description: '선택한 글자의 색을 바꿉니다.', fullOnly: true },
    { icon: Highlighter, title: '형광펜', description: '선택한 글자의 배경을 강조합니다.', fullOnly: true },
  ] },
  { title: '문단 · 목록', items: [
    { label: 'P', title: '본문', description: '현재 문단을 일반 본문으로 바꿉니다.' },
    { icon: Heading1, title: '제목 1', description: '큰 제목으로 바꿉니다.' },
    { icon: Heading2, title: '제목 2', description: '중간 제목으로 바꿉니다.' },
    { icon: Heading3, title: '제목 3', description: '작은 제목으로 바꿉니다.', fullOnly: true },
    { icon: List, title: '글머리 목록', description: '순서 없는 목록을 만듭니다.' },
    { icon: ListOrdered, title: '번호 목록', description: '순서가 있는 목록을 만듭니다.' },
    { icon: ListChecks, title: '체크리스트', description: '완료 여부를 체크하는 목록을 만듭니다.', fullOnly: true },
    { icon: Quote, title: '인용', description: '설명이나 인용 내용을 별도 문단으로 구분합니다.' },
    { icon: AlignLeft, title: '왼쪽 정렬', description: '문단을 왼쪽에 맞춥니다.', fullOnly: true },
    { icon: AlignCenter, title: '가운데 정렬', description: '문단을 가운데에 맞춥니다.', fullOnly: true },
    { icon: AlignRight, title: '오른쪽 정렬', description: '문단을 오른쪽에 맞춥니다.', fullOnly: true },
    { icon: AlignJustify, title: '양쪽 정렬', description: '문단의 양쪽 가장자리를 맞춥니다.', fullOnly: true },
  ] },
  { title: '링크 · 자료', items: [
    { icon: Link, title: '링크 삽입/제거', description: '텍스트를 선택하고 URL을 입력합니다. URL을 비우고 확인하면 링크를 제거합니다.' },
    { icon: Minus, title: '수평선', description: '내용을 구분하는 가로선을 넣습니다.', fullOnly: true },
    { icon: Table, title: '표', description: '행과 열을 선택해 표를 넣습니다.', fullOnly: true },
    { icon: Image, title: '이미지', description: '이미지 파일을 선택해 본문에 넣습니다.', fullOnly: true, imageOnly: true },
    { icon: Video, title: 'YouTube', description: 'YouTube 주소로 영상 블록을 넣습니다.', fullOnly: true },
  ] },
  { title: '코드 · 미리보기', items: [
    { label: '{ }', title: '코드 블록', description: '여러 줄 코드를 별도 블록으로 작성합니다.', fullOnly: true },
    { label: 'MD', title: 'Markdown 삽입', description: 'Markdown을 입력해 편집기 문서로 변환합니다.' },
    { icon: GitBranch, title: 'Mermaid', description: 'Mermaid 코드로 다이어그램을 넣습니다.' },
    { icon: PanelTop, title: 'HTML 미리보기', description: 'HTML/CSS 화면을 미리보기 블록으로 넣습니다.' },
    { icon: Blocks, title: '컴포넌트 미리보기', description: '갤러리 컴포넌트를 선택해 미리보기로 넣습니다.' },
    { label: 'TW', title: 'Tailwind TSX', description: 'Tailwind TSX 코드를 작성하고 화면을 미리 봅니다.' },
  ] },
]

export function ToolbarHelp({ variant, hasImageUpload }: {
  variant: 'full' | 'simple'
  hasImageUpload: boolean
}) {
  const [activeTab, setActiveTab] = useState(0)
  const tabId = useId()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  return (
    <Dialog.Root onOpenChange={open => { if (open) setActiveTab(0) }}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="편집기 버튼 안내"
          title="편집기 버튼 안내"
          className="absolute right-3 top-2 flex size-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-strong hover:text-text-primary focus-visible:outline-2 focus-visible:outline-brand-primary"
        >
          <CircleHelp className="size-4" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[240] bg-black/35" />
        <Dialog.Content
          style={{ height: 520, maxHeight: 'calc(100dvh - 32px)' }}
          className="fixed left-1/2 top-1/2 z-[241] flex w-[min(760px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-surface-border-soft bg-surface-raised shadow-2xl"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-surface-border-soft p-4">
            <div>
              <Dialog.Title className="text-base font-bold text-text-primary">편집기 버튼 안내</Dialog.Title>
              <Dialog.Description className="mt-1 text-xs leading-5 text-text-secondary">
                글자 서식은 텍스트를 선택한 뒤, 문단 서식은 해당 문단에 커서를 둔 뒤 사용하세요.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" aria-label="버튼 안내 닫기" className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-surface-muted">
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>
          <div role="tablist" aria-label="버튼 기능 분류" className="flex shrink-0 gap-1 overflow-x-auto border-b border-surface-border-soft px-4 py-2">
            {HELP_GROUPS.map((group, index) => (
              <button
                key={group.title}
                ref={element => { tabRefs.current[index] = element }}
                type="button"
                role="tab"
                id={`${tabId}-tab-${index}`}
                aria-controls={`${tabId}-panel-${index}`}
                aria-selected={activeTab === index}
                tabIndex={activeTab === index ? 0 : -1}
                onClick={() => setActiveTab(index)}
                onKeyDown={event => {
                  let next: number
                  if (event.key === 'ArrowRight') next = (index + 1) % HELP_GROUPS.length
                  else if (event.key === 'ArrowLeft') next = (index - 1 + HELP_GROUPS.length) % HELP_GROUPS.length
                  else if (event.key === 'Home') next = 0
                  else if (event.key === 'End') next = HELP_GROUPS.length - 1
                  else return
                  event.preventDefault()
                  setActiveTab(next)
                  tabRefs.current[next]?.focus()
                }}
                className={`min-h-9 flex-1 shrink-0 whitespace-nowrap rounded-md px-3 text-xs font-bold focus-visible:outline-2 focus-visible:outline-brand-primary ${activeTab === index ? 'bg-brand-primary text-white' : 'text-text-secondary hover:bg-surface-muted'}`}
              >
                {group.title}
              </button>
            ))}
          </div>
              {HELP_GROUPS.map((group, index) => (
                <section
                  key={group.title}
                  role="tabpanel"
                  id={`${tabId}-panel-${index}`}
                  aria-labelledby={`${tabId}-tab-${index}`}
                  hidden={activeTab !== index}
                  tabIndex={0}
                  className="min-h-0 flex-1 overflow-y-auto p-4 focus-visible:outline-2 focus-visible:outline-brand-primary"
                >
                  {index === 2 ? (
                    <p className="mb-4 rounded-md bg-brand-glass px-3 py-2 text-xs leading-5 text-text-primary">
                      <strong>주소 자동 링크:</strong> http://, https://, www. 주소 끝에서 Enter를 누르면 링크로 바뀌고 다음 줄로 이동합니다. 코드 블록·인라인 코드에는 적용하지 않습니다.
                    </p>
                  ) : null}
                  <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
                    {group.items.filter(item => (variant === 'full' || !item.fullOnly) && (!item.imageOnly || hasImageUpload)).map(item => (
                      <div key={item.title} className="flex min-w-0 gap-2">
                        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-md border border-surface-border-soft bg-surface-muted text-text-secondary">
                          {item.icon ? <item.icon className="size-3.5" /> : <span className="text-[11px] font-bold">{item.label}</span>}
                        </span>
                        <div className="min-w-0">
                          <dt className="text-xs font-bold leading-5 text-text-primary">{item.title}</dt>
                          <dd className="break-keep text-xs leading-5 text-text-secondary">{item.description}</dd>
                        </div>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
          <div className="flex shrink-0 justify-end border-t border-surface-border-soft px-4 py-2">
            <Dialog.Close asChild><Button type="button" variant="secondary" size="sm">닫기</Button></Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
