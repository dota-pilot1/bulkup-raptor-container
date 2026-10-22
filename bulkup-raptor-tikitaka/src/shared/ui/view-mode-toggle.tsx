import type { LucideIcon } from 'lucide-react'

type ViewModeItem<T extends string> = {
  value: T
  label: string
  icon: LucideIcon
}

type ViewModeToggleProps<T extends string> = {
  value: T
  items: readonly ViewModeItem<T>[]
  onChange: (value: T) => void
  ariaLabel: string
}

/** 미리보기/코드, 목록/카드처럼 같은 영역의 보기 방식을 짧게 바꾸는 공통 컨트롤. */
export function ViewModeToggle<T extends string>({ value, items, onChange, ariaLabel }: ViewModeToggleProps<T>) {
  const activeIndex = Math.max(0, items.findIndex((item) => item.value === value))

  return (
    <div
      className="relative inline-grid box-border h-8 min-w-[168px] overflow-hidden rounded-md border border-surface-border-soft bg-surface-muted p-px"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      role="tablist"
      aria-label={ariaLabel}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-[4px] border border-brand-primary bg-brand-primary shadow-[0_2px_5px_rgba(25,118,210,0.28)] transition-transform duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
        style={{
          top: '1px',
          right: 'auto',
          bottom: '1px',
          left: '1px',
          width: `calc(${100 / items.length}% - ${2 / items.length}px)`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
      {items.map((item) => {
        const active = item.value === value
        const Icon = item.icon
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={`relative z-10 inline-flex h-full min-w-0 items-center justify-center gap-1.5 rounded-[4px] px-2.5 text-[11px] font-black leading-none transition-colors duration-200 ease-out ${active ? 'text-text-on-brand' : 'text-text-muted hover:text-text-primary'}`}
          >
            <span className="inline-flex -translate-x-px items-center gap-1">
              <Icon className="size-3.5 shrink-0" />
              <span className="block translate-y-px leading-none">{item.label}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
