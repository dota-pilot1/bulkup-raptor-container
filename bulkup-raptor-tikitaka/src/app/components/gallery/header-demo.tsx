import { useState } from 'react';
import { Header, type HeaderNavItem } from './header';
import './header.css';

const NAV: HeaderNavItem[] = [
  { id: 'dashboard', label: '대시보드', href: '/dashboard' },
  { id: 'lot', label: 'LOT 조회', href: '/production/lot' },
  { id: 'quality', label: '품질', href: '/quality' },
  { id: 'equipment', label: '설비', href: '/equipment' },
];

/**
 * 갤러리 전용 시연 래퍼.
 * sticky는 스크롤이 있어야 확인되므로, 헤더를 스크롤 컨테이너 안에 넣고 본문을 길게 둔다.
 * 실제 앱에서는 activeId를 라우터에서 읽고 onSelect 대신 <Link>를 쓴다.
 */
export function HeaderDemo({
  sticky = true,
  dense = false,
  search = true,
}: {
  sticky?: boolean;
  dense?: boolean;
  search?: boolean;
}) {
  const [activeId, setActiveId] = useState('lot');

  return (
    <div
      style={{
        // 미리보기 자리가 place-items:center라 폭을 주지 않으면 내용만큼 줄어든다.
        width: '100%',
        height: 300,
        overflow: 'auto',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
      }}
    >
      <Header
        brand="PKT MES"
        items={NAV}
        activeId={activeId}
        onSelect={setActiveId}
        sticky={sticky}
        dense={dense}
        search={search}
        user={{ name: '오현석', role: '공정 관리자' }}
        label="상단 메뉴"
        mainId="hd-demo-main"
      />

      {/* 건너뛰기 링크가 가리키는 곳. tabIndex가 없으면 초점이 실제로 옮겨지지 않는 브라우저가 있다. */}
      <main id="hd-demo-main" tabIndex={-1} style={{ padding: 16, color: '#475569', fontSize: 13, fontWeight: 700 }}>
        선택된 항목: <code style={{ color: '#2563eb' }}>{activeId}</code>
        <p style={{ marginTop: 10, fontWeight: 600, lineHeight: 1.7 }}>
          이 상자 안을 스크롤해 보세요. 고정을 켜면 헤더가 위에 붙습니다.
          <br />
          Tab을 처음 누르면 &quot;본문으로 건너뛰기&quot;가 먼저 나타납니다. 메뉴를 매번 훑지 않게 하는 장치입니다.
          <br />
          프로필을 열고 Esc를 누르면 초점이 버튼으로 되돌아옵니다.
        </p>
        {Array.from({ length: 8 }, (_, index) => (
          <p key={index} style={{ marginTop: 10, fontWeight: 600, color: '#94a3b8' }}>
            LOT-2408{index + 10} · 노광 공정 · 진행 중
          </p>
        ))}
      </main>
    </div>
  );
}
