import type { ReactNode } from 'react';
import './tabs.css';

export type TabItem = {
  id: string;
  label: string;
  count?: number;
  disabled?: boolean;
  panel: ReactNode;
};

type TabsProps = {
  items: TabItem[];
  activeId: string;
  onSelect: (id: string) => void;
  variant?: 'line' | 'pill';
  dense?: boolean;
};

/**
 * 탭은 페이지 이동이 아니라 같은 맥락 안의 패널 전환에 사용한다.
 * 선택 상태는 밖에서 받아 URL·라우터와 연결할 수 있게 하고, 키보드 이동은 버튼의 기본 동작을 보존한다.
 */
export function Tabs({ items, activeId, onSelect, variant = 'line', dense = false }: TabsProps) {
  const active = items.find((item) => item.id === activeId) ?? items[0];

  return (
    <section className={`tabs tabs-${variant}${dense ? ' tabs-dense' : ''}`}>
      <div className="tabs-list" role="tablist" aria-label="콘텐츠 탭">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={item.id === active?.id}
            aria-controls={`panel-${item.id}`}
            tabIndex={item.id === active?.id ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onSelect(item.id)}
          >
            <span>{item.label}</span>
            {item.count != null ? <span className="tabs-count">{item.count}</span> : null}
          </button>
        ))}
      </div>
      {active ? (
        <div
          className="tabs-panel"
          role="tabpanel"
          id={`panel-${active.id}`}
          aria-labelledby={`tab-${active.id}`}
          tabIndex={0}
        >
          {active.panel}
        </div>
      ) : null}
    </section>
  );
}
