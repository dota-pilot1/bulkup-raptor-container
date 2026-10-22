import { useState } from 'react';
import { Breadcrumb, type BreadcrumbItem } from './breadcrumb';
import './breadcrumb.css';

const ITEMS: BreadcrumbItem[] = [
  { id: 'home', label: '홈', href: '/' },
  { id: 'production', label: '생산 관리', href: '/production' },
  { id: 'lot', label: 'LOT 조회', href: '/production/lots' },
  { id: 'detail', label: 'LOT-24084 상세' },
];

/** 갤러리 전용 래퍼. 실제 재사용 대상은 breadcrumb.tsx의 Breadcrumb이다. */
export function BreadcrumbDemo({ compact = false }: { compact?: boolean }) {
  const [selectedId, setSelectedId] = useState('detail');
  return (
    <div style={{ width: '100%', padding: '18px 20px', border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff' }}>
      <Breadcrumb items={ITEMS} compact={compact} onNavigate={setSelectedId} />
      <p style={{ margin: '18px 0 0', color: '#475569', fontSize: 13, fontWeight: 600 }}>
        현재 위치: <strong style={{ color: '#1d4ed8' }}>{selectedId}</strong>
      </p>
    </div>
  );
}
