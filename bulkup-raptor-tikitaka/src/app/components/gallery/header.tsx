import Link from 'next/link';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import './header.css';

export type HeaderNavItem = {
  id: string;
  label: string;
  /** 라우터를 쓰면 실제 경로를 넣는다. 없으면 '#'로 떨어진다. */
  href?: string;
};

type HeaderProps = {
  brand: string;
  items: HeaderNavItem[];
  /** 현재 페이지. 보통 라우터가 쥐고 있으므로 밖에서 받는다. */
  activeId: string;
  onSelect: (id: string) => void;
  /** 검색을 헤더에 둘지. 화면 성격에 따라 다르므로 밖에서 정한다. */
  search?: boolean;
  /** 스크롤해도 위에 붙어 있게 한다. 표를 길게 보는 화면에서 특히 쓸모 있다. */
  sticky?: boolean;
  dense?: boolean;
  user?: { name: string; role: string };
  /** nav 랜드마크의 이름. 사이드바가 함께 있는 화면이면 서로 다르게 준다. */
  label?: string;
  /** 건너뛰기 링크가 가리킬 본문 요소의 id. */
  mainId?: string;
  onSignOut?: () => void;
  actions?: ReactNode;
};

/**
 * 골격 요약
 * - 바깥은 <header>. 페이지에 하나만 두면 banner 랜드마크가 된다. 둘 이상이면 랜드마크가 아니게 된다.
 * - 첫 초점은 "본문으로 건너뛰기" 링크다. 키보드 사용자가 메뉴를 매 페이지 훑지 않게 하는 유일한 장치이고,
 *   평소엔 눈에서 빼 두되 초점을 받으면 반드시 보여야 한다.
 * - 메뉴는 <nav aria-label> + ul/li. 사이드바와 같은 이유로 이름을 붙인다. 둘 다 "내비게이션"이면 구분이 안 된다.
 * - 현재 페이지는 aria-current="page". 밑줄만 그으면 눈으로만 보이는 상태가 된다.
 * - 검색은 <form role="search">. 이것이 landmark가 되고, 입력에는 보이지 않더라도 label이 있어야 한다.
 * - 아이콘만 있는 버튼은 aria-label이 곧 이름이다. 배지 숫자도 그 이름 안에 넣어야 읽힌다.
 * - 사용자 메뉴는 aria-expanded + aria-haspopup="menu". Esc와 바깥 클릭으로 닫고, 닫을 때 초점을 버튼으로 되돌린다.
 */
export function Header({
  brand,
  items,
  activeId,
  onSelect,
  search = true,
  sticky = false,
  dense = false,
  user,
  label = '상단 메뉴',
  mainId = 'main',
  onSignOut,
  actions,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // 한 화면에 Header가 둘 이상 있어도 id가 엉키지 않도록 인스턴스마다 접두사를 붙인다.
  const uid = useId();
  const menuId = `hd-menu-${uid}`;
  const searchId = `hd-search-${uid}`;

  const closeMenu = (focusBack: boolean) => {
    setMenuOpen(false);
    // 초점을 그냥 잃게 두면 키보드 사용자는 문서 맨 위로 돌아간다.
    if (focusBack) menuButtonRef.current?.focus();
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu(true);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className={`hd${sticky ? ' is-sticky' : ''}${dense ? ' is-dense' : ''}`}>
      {/* 마크업 순서상 첫 초점이어야 의미가 있다. 그래서 스타일이 아니라 위치로 보장한다. */}
      <a className="hd-skip" href={`#${mainId}`}>
        본문으로 건너뛰기
      </a>

      <Link
        className="hd-brand"
        href="/"
        onClick={(event) => {
          event.preventDefault();
          onSelect(items[0]?.id ?? '');
        }}
      >
        <span className="hd-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 20h18M5 20V9l5 3V9l5 3V9l4 3v8" />
          </svg>
        </span>
        {brand}
      </Link>

      <nav className="hd-nav" aria-label={label}>
        <ul className="hd-list">
          {items.map((item) => (
            <li key={item.id}>
              <a
                className="hd-link"
                href={item.href ?? '#'}
                // 색이나 밑줄이 아니라 이 속성이 "현재 페이지"의 진짜 표시다.
                aria-current={item.id === activeId ? 'page' : undefined}
                onClick={(event) => {
                  // 라우터를 붙이면 이 줄을 지우고 <Link>로 바꾼다.
                  event.preventDefault();
                  onSelect(item.id);
                }}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {search && (
        // role="search"가 이 폼을 랜드마크로 만든다. div로 감싸면 그 기능이 사라진다.
        <form
          className="hd-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          {/* placeholder는 label이 아니다. 입력하면 사라지므로 이름으로 쓸 수 없다. */}
          <label className="hd-sr-only" htmlFor={searchId}>
            문서 검색
          </label>
          <span className="hd-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </span>
          <input
            id={searchId}
            className="hd-input"
            type="search"
            value={query}
            placeholder="LOT 번호, 문서 제목"
            onChange={(event) => setQuery(event.target.value)}
          />
        </form>
      )}

      <div className="hd-actions">
        {actions}

        <button type="button" className="hd-icon-button" aria-label="알림 3건">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
          </svg>
          {/* 숫자는 눈으로만 보는 장식이다. 읽어 줄 값은 이미 위 aria-label에 들어 있다. */}
          <span className="hd-dot" aria-hidden="true">
            3
          </span>
        </button>

        {user && (
          <div className="hd-menu-wrap" ref={menuRef}>
            <button
              type="button"
              ref={menuButtonRef}
              className="hd-user"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="hd-avatar" aria-hidden="true">
                {user.name.charAt(0)}
              </span>
              <span className="hd-user-text">
                <span className="hd-user-name">{user.name}</span>
                <span className="hd-user-role">{user.role}</span>
              </span>
            </button>

            {/*
              닫힌 메뉴는 아예 그리지 않는다. hidden으로 남겨 두면 초점 순서에서는 빠지지만
              메뉴 항목 수가 보조기기에 계속 노출된다.
            */}
            {menuOpen && (
              <div className="hd-menu" id={menuId} role="menu">
                <button type="button" role="menuitem" className="hd-menu-item" onClick={() => closeMenu(true)}>
                  내 정보
                </button>
                <button type="button" role="menuitem" className="hd-menu-item" onClick={() => closeMenu(true)}>
                  환경 설정
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="hd-menu-item is-danger"
                  onClick={() => {
                    closeMenu(false);
                    onSignOut?.();
                  }}
                >
                  로그아웃
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
