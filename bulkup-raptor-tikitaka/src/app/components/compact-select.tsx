import type { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '../lib/utils'

type CompactSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  wrapperClassName?: string
}

export function CompactSelect({
  className,
  wrapperClassName,
  children,
  ...props
}: CompactSelectProps) {
  return (
    <div className={cn('compact-select-wrap relative shrink-0', wrapperClassName)}>
      <select
        className={cn(
          'compact-select h-9 min-h-9 w-full appearance-none rounded-md border border-surface-border-soft bg-surface-raised py-0 pl-3 pr-8 text-sm font-medium leading-none text-text-primary shadow-none outline-none transition-all hover:border-brand-border/70 focus:border-brand-border focus:ring-1 focus:ring-brand-border/15 disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-text-muted" />
    </div>
  )
}
