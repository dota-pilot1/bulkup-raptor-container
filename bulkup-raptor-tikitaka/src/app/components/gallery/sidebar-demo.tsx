import { useState } from 'react';
import { Sidebar, type SidebarItem } from './sidebar';
import './sidebar.css';

/** 아이콘도 외부 패키지 없이 인라인 SVG로 둔다. 폐쇄망에서 lucide를 못 받기 때문이다. */
const icon = (path: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
);

const MENU: SidebarItem[] = [
  { id: 'dashboard', label: '대시보드', href: '/dashboard', icon: icon('M4 4h7v7H4zM13 4h7v4h-7zM13 12h7v8h-7zM4 15h7v5H4z') },
  {
    id: 'production',
    label: '생산 관리',
    icon: icon('M3 20h18M5 20V9l5 3V9l5 3V9l4 3v8'),
    children: [
      { id: 'lot', label: 'LOT 조회', href: '/production/lot', badge: 12 },
      { id: 'work-order', label: '작업 지시', href: '/production/work-order' },
      { id: 'yield', label: '수율 분석', href: '/production/yield' },
    ],
  },
  {
    id: 'quality',
    label: '품질',
    icon: icon('M12 3l8 4v5c0 4.5-3.2 7.9-8 9-4.8-1.1-8-4.5-8-9V7z'),
    children: [
      { id: 'inspection', label: '검사 이력', href: '/quality/inspection' },
      { id: 'defect', label: '불량 코드', href: '/quality/defect', badge: 3 },
    ],
  },
  { id: 'equipment', label: '설비', href: '/equipment', icon: icon('M7 7h10v10H7zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4') },
  { id: 'settings', label: '환경 설정', href: '/settings', icon: icon('M4 6h16M4 12h16M4 18h16M9 4v4M15 10v4M7 16v4') },
];

/**
 * 갤러리 전용 시연 래퍼.
 * 실제 앱에서는 activeId를 라우터에서 읽고 onSelect 대신 <Link>를 쓴다.
 * 여기서는 라우터가 없으므로 state 하나로 대신한다.
 */
export function SidebarDemo({
  collapsed = false,
  dense = false,
  theme = 'light',
  label = '주 메뉴',
}: {
  collapsed?: boolean;
  dense?: boolean;
  theme?: 'light' | 'dark';
  label?: string;
}) {
  const [activeId, setActiveId] = useState('lot');

  return (
    <div style={{ display: 'flex', gap: 16, minHeight: 340, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
      <Sidebar items={MENU} activeId={activeId} onSelect={setActiveId} collapsed={collapsed} dense={dense} theme={theme} label={label} />
      <div style={{ flex: 1, padding: '10px 4px', color: '#475569', fontSize: 13, fontWeight: 700 }}>
        선택된 항목: <code style={{ color: '#2563eb' }}>{activeId}</code>
        <p style={{ marginTop: 10, fontWeight: 600, lineHeight: 1.7 }}>
          Tab으로 항목 사이를 이동해 보세요. 그룹은 Enter/Space로 펼칩니다.
          <br />
          접힘을 켜면 라벨이 눈에서만 사라지고, 하위 메뉴는 오른쪽에 떠오릅니다.
          <br />
          컨트롤에서 <code>theme</code>를 <strong>light / dark</strong>로 전환해 볼 수 있습니다.
        </p>
      </div>
    </div>
  );
}

