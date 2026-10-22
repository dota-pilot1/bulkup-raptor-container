/* eslint-disable react-hooks/set-state-in-effect -- animation/layout state follows DOM visibility transitions. */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type TransitionEvent } from 'react';
import './sidebar.css';

export type SidebarItem = {
  id: string;
  label: string;
  /** 라우터를 쓰면 실제 경로를 넣는다. 없으면 '#'로 떨어진다. */
  href?: string;
  icon?: ReactNode;
  badge?: string | number;
  children?: SidebarItem[];
};

type SidebarProps = {
  items: SidebarItem[];
  /** 현재 페이지. 보통 라우터가 쥐고 있으므로 밖에서 받는다. */
  activeId: string;
  onSelect: (id: string) => void;
  collapsed?: boolean;
  dense?: boolean;
  /** 테마: 'light' (기본값) 또는 'dark' */
  theme?: 'light' | 'dark';
  /** nav 랜드마크의 이름. 한 화면에 nav가 둘 이상이면 서로 다르게 준다. */
  label?: string;
};

/**
 * 하위 목록의 여닫힘.
 * display:none은 높이가 트랜지션되지 않으므로, 닫히는 동안에는 hidden을 붙이지 않고
 * 애니메이션이 끝난 뒤에 붙인다. 보조기기에서 사라지는 시점만 0.2초 뒤로 밀리는 셈이다.
 * 접힘(flyout)에서는 밀어낼 자리가 없으므로 높이 대신 페이드로 여닫는다.
 */
function SubMenu({
  id,
  open,
  collapsed,
  children,
}: {
  id: string;
  open: boolean;
  collapsed: boolean;
  children: ReactNode;
}) {
  const clipRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [hidden, setHidden] = useState(!open);

  useEffect(() => {
    const clip = clipRef.current;
    const list = listRef.current;
    if (!clip || !list) return;
    if (collapsed) return; // flyout은 높이를 건드리지 않는다.
    if (open) {
      // display:none인 동안에는 높이를 잴 수 없다. 먼저 보이게 한 뒤 다음 렌더에서 잡는다.
      if (hidden) {
        setHidden(false);
        return;
      }
      clip.style.height = `${list.offsetHeight}px`;
      return;
    }
    // auto에서 0으로는 트랜지션이 걸리지 않으니, 지금 높이를 픽셀로 굳힌 뒤 0으로 보낸다.
    clip.style.height = `${clip.offsetHeight}px`;
    const raf = requestAnimationFrame(() => {
      clip.style.height = '0px';
    });
    return () => cancelAnimationFrame(raf);
  }, [open, hidden, collapsed]);

  useEffect(() => {
    if (open) setHidden(false);
  }, [open]);

  const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (!open) {
      setHidden(true);
      return;
    }
    // 열린 뒤에는 auto로 돌려 둔다. dense를 켜거나 항목이 바뀌어도 높이가 어긋나지 않는다.
    if (event.propertyName === 'height' && clipRef.current) clipRef.current.style.height = 'auto';
  };

  return (
    <div
      ref={clipRef}
      id={id}
      hidden={hidden}
      onTransitionEnd={handleTransitionEnd}
      className={`sb-sub-clip${open ? ' is-open' : ''}`}
      style={{ height: collapsed ? undefined : 0 }}
    >
      <ul ref={listRef} className="sb-sub">
        {children}
      </ul>
    </div>
  );
}

/**
 * 골격 요약
 * - 바깥은 <nav aria-label>. 랜드마크가 있어야 스크린리더가 "메뉴로 건너뛰기"를 할 수 있다.
 * - 목록은 <ul>/<li>. 항목이 몇 개인지 읽어 주는 것은 이 구조뿐이다.
 * - 이동하는 항목은 <a>, 펼치기만 하는 항목은 <button>. 역할이 다르면 태그도 달라야 한다.
 * - 현재 페이지는 aria-current="page". 색만 칠하면 눈으로만 보이는 상태가 된다.
 * - 펼치기 버튼은 aria-expanded + aria-controls로 어느 목록을 여는지 가리킨다.
 */
export function Sidebar({
  items,
  activeId,
  onSelect,
  collapsed = false,
  dense = false,
  theme = 'light',
  label = '주 메뉴',
}: SidebarProps) {
  // 펼침은 순수 UI 상태라 안에서 갖는다. 활성 항목과 달리 주소에 남을 이유가 없다.
  // 활성 자식을 품은 그룹만 열어 두되, 접힘일 때는 flyout이 저절로 떠 버리므로 모두 닫는다.
  const autoOpen = () =>
    collapsed
      ? []
      : items.filter((item) => item.children?.some((child) => child.id === activeId)).map((item) => item.id);

  const [openIds, setOpenIds] = useState<string[]>(autoOpen);

  // 접기/펴기를 오갈 때마다 펼침 상태를 그 모드의 기본값으로 되돌린다.
  useEffect(() => {
    setOpenIds(autoOpen());
    // autoOpen은 collapsed에만 반응하면 된다. 목록이 바뀌면 어차피 다시 마운트된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

  // 한 화면에 Sidebar가 둘 이상 있어도 aria-controls가 엉키지 않도록 인스턴스마다 접두사를 붙인다.
  const uid = useId();

  const toggleGroup = (id: string) =>
    setOpenIds((prev) => {
      if (prev.includes(id)) return prev.filter((openId) => openId !== id);
      // 펼친 상태의 하위 목록은 아래로 밀고 들어가므로 여러 개가 동시에 열려도 된다.
      // 접힘에서는 같은 자리에 떠올라 서로 겹치므로 한 번에 하나만 연다.
      return collapsed ? [id] : [...prev, id];
    });

  // 떠 있는 하위 메뉴는 Esc로 닫힌다. 펼친 상태에서는 닫을 것이 없다.
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (collapsed && event.key === 'Escape') setOpenIds([]);
  };

  const renderLink = (item: SidebarItem) => (
    <a
      className="sb-row"
      href={item.href ?? '#'}
      // 색이 아니라 이 속성이 "현재 페이지"의 진짜 표시다.
      aria-current={item.id === activeId ? 'page' : undefined}
      // 접히면 라벨이 눈에서 사라지므로 마우스 사용자에게는 툴팁으로 준다.
      title={collapsed ? item.label : undefined}
      onClick={(event) => {
        // 라우터를 붙이면 이 줄을 지우고 <Link>로 바꾼다.
        event.preventDefault();
        onSelect(item.id);
        // 떠 있는 하위 메뉴는 항목을 고르면 닫는다. 펼친 상태에서는 열어 둔다.
        if (collapsed) setOpenIds([]);
      }}
    >
      <span className="sb-icon" aria-hidden="true">
        {item.icon}
      </span>
      <span className="sb-label">{item.label}</span>
      {item.badge != null ? <span className="sb-badge">{item.badge}</span> : null}
    </a>
  );

  const renderGroup = (item: SidebarItem) => {
    const open = openIds.includes(item.id);
    const hasActiveChild = item.children?.some((child) => child.id === activeId) ?? false;
    const subId = `sb-sub-${uid}-${item.id}`;

    return (
      <>
        <button
          type="button"
          className={`sb-row${hasActiveChild ? ' is-parent-active' : ''}`}
          aria-expanded={open}
          aria-controls={subId}
          title={collapsed ? item.label : undefined}
          onClick={() => toggleGroup(item.id)}
        >
          <span className="sb-icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="sb-label">{item.label}</span>
          <span className="sb-caret" aria-hidden="true" />
        </button>
        {/*
          닫힌 목록은 결국 hidden 속성으로 숨는다. display:none으로만 숨기고 hidden을 빼면
          화면에서만 사라지고 보조기기에는 남는다. 반대로 [hidden]을 CSS로 되살리는 것도 같은 이유로 금물.
          접힘일 때는 이 목록이 항목 오른쪽에 떠오르는 flyout이 될 뿐, 여닫는 조건은 똑같다.
        */}
        <SubMenu id={subId} open={open} collapsed={collapsed}>
          {item.children?.map((child) => (
            <li key={child.id} className="sb-item">
              {renderLink(child)}
            </li>
          ))}
        </SubMenu>
      </>
    );
  };

  return (
    <nav
      className={`sb${collapsed ? ' is-collapsed' : ''}${dense ? ' is-dense' : ''}${theme === 'dark' ? ' is-dark' : ''}`}
      data-theme={theme}
      aria-label={label}
      onKeyDown={handleKeyDown}
    >
      <ul className="sb-list">
        {items.map((item) => (
          <li key={item.id} className="sb-item">
            {item.children?.length ? renderGroup(item) : renderLink(item)}
          </li>
        ))}
      </ul>
    </nav>
  );
}
