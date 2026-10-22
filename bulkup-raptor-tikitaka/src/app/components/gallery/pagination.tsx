import './pagination.css';

type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  compact?: boolean;
};

function pageItems(page: number, pageCount: number): Array<number | 'ellipsis'> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, 'ellipsis', pageCount];
  if (page >= pageCount - 3) return [1, 'ellipsis', pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
  return [1, 'ellipsis', page - 1, page, page + 1, 'ellipsis', pageCount];
}

/** 페이지 경계를 보정하고, 현재 위치를 aria-current로 함께 알리는 공통 Pagination이다. */
export function Pagination({ page, pageCount, onPageChange, compact = false }: PaginationProps) {
  const safePage = Math.min(Math.max(page, 1), Math.max(pageCount, 1));
  const items = pageItems(safePage, pageCount);
  const go = (nextPage: number) => onPageChange(Math.min(Math.max(nextPage, 1), pageCount));

  if (pageCount <= 1) return null;

  return (
    <nav className={`pagination${compact ? ' pagination-compact' : ''}`} aria-label="페이지 이동">
      <button type="button" aria-label="첫 페이지" disabled={safePage === 1} onClick={() => go(1)}>«</button>
      <button type="button" aria-label="이전 페이지" disabled={safePage === 1} onClick={() => go(safePage - 1)}>‹</button>
      <ol>
        {items.map((item, index) => item === 'ellipsis' ? (
          <li key={`ellipsis-${index}`}><span aria-hidden="true">…</span></li>
        ) : (
          <li key={item}>
            <button type="button" aria-label={`${item}페이지`} aria-current={item === safePage ? 'page' : undefined} onClick={() => go(item)}>{item}</button>
          </li>
        ))}
      </ol>
      <button type="button" aria-label="다음 페이지" disabled={safePage === pageCount} onClick={() => go(safePage + 1)}>›</button>
      <button type="button" aria-label="마지막 페이지" disabled={safePage === pageCount} onClick={() => go(pageCount)}>»</button>
    </nav>
  );
}
