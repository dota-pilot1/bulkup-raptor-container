import { useState } from 'react';
import { Pagination } from './pagination';
import './pagination.css';

/** 갤러리 전용 래퍼. 실제 재사용 대상은 pagination.tsx의 Pagination이다. */
export function PaginationDemo({ compact = false }: { compact?: boolean }) {
  const [page, setPage] = useState(4);
  return (
    <div style={{ display: 'grid', gap: 16, justifyItems: 'center', width: '100%', padding: 20, border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff' }}>
      <Pagination page={page} pageCount={12} onPageChange={setPage} compact={compact} />
      <span style={{ color: '#64748b', fontSize: 13, fontWeight: 700 }}>현재 페이지: {page} / 12</span>
    </div>
  );
}
