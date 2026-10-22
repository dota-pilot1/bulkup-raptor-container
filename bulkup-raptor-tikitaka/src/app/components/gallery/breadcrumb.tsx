import type { ReactNode } from 'react';
import './breadcrumb.css';

export type BreadcrumbItem = {
  id: string;
  label: string;
  href?: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
  compact?: boolean;
  onNavigate?: (id: string) => void;
  separator?: ReactNode;
};

/**
 * Breadcrumb은 현재 위치를 설명하는 보조 내비게이션이다.
 * 이동 가능한 항목은 링크로, 마지막 현재 위치는 aria-current="page"가 있는 텍스트로 표시한다.
 */
export function Breadcrumb({ items, compact = false, onNavigate, separator = '/' }: BreadcrumbProps) {
  const visibleItems = compact && items.length > 3
    ? [items[0], { id: 'ellipsis', label: '…' }, ...items.slice(-2)]
    : items;

  return (
    <nav className={`breadcrumb${compact ? ' breadcrumb-compact' : ''}`} aria-label="breadcrumb">
      <ol>
        {visibleItems.map((item, index) => {
          const isCurrent = index === visibleItems.length - 1;
          const isEllipsis = item.id === 'ellipsis';
          return (
            <li key={`${item.id}-${index}`}>
              {isCurrent || isEllipsis ? (
                <span aria-current={isCurrent ? 'page' : undefined} className={isEllipsis ? 'breadcrumb-ellipsis' : undefined}>
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href ?? '#'}
                  onClick={(event) => {
                    if (!item.href || onNavigate) event.preventDefault();
                    onNavigate?.(item.id);
                  }}
                >
                  {item.label}
                </a>
              )}
              {!isCurrent ? <span className="breadcrumb-separator" aria-hidden="true">{separator}</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
