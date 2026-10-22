import { useState } from 'react';
import { Tabs, type TabItem } from './tabs';
import './tabs.css';

const ITEMS: TabItem[] = [
  { id: 'overview', label: '개요', count: 3, panel: '현재 작업의 요약과 핵심 상태를 보여 줍니다.' },
  { id: 'history', label: '이력', count: 12, panel: '같은 대상의 변경 이력을 시간순으로 보여 줍니다.' },
  { id: 'settings', label: '설정', panel: '현재 맥락에 속한 표시·동작 옵션을 조정합니다.' },
];

/** 갤러리 전용 래퍼. 실제 재사용 대상은 tabs.tsx의 Tabs다. */
export function TabsDemo({ variant = 'line', dense = false }: { variant?: 'line' | 'pill'; dense?: boolean }) {
  const [activeId, setActiveId] = useState('overview');

  return <Tabs items={ITEMS} activeId={activeId} onSelect={setActiveId} variant={variant} dense={dense} />;
}
