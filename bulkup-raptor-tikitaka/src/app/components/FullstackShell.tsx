"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  AlertTriangle, Bookmark, BookOpen, Boxes, ChevronDown, ClipboardList, Code2, Coffee, Copy, CreditCard, Database, GraduationCap, KeyRound, Laptop, LayoutDashboard, Leaf, Library, LockKeyhole, LogOut, PackageCheck, PenTool, Rocket, RotateCcw, Search, Settings, ShieldCheck, ShoppingCart, Sparkles, Target, TestTube, Truck, User, Workflow, type LucideIcon,
} from "lucide-react";
import { ContentRefreshProvider } from "@/shared/lib/content-refresh";
import { RailToggleProvider } from "@/shared/lib/rail-toggle";
import { ToastProvider } from "@/shared/ui/toast";
import { BookmarkProvider } from "@/features/hospital-playbook/bookmarks";
import packageJson from "../../../package.json";

type RailGroup = "architecture" | "data-access" | "auth" | "catalog" | "admin" | "storefront" | "commerce" | "quality" | "devops";
type RailSubgroup = RailGroup;
type RailItem = { label: string; moduleLabel?: string; icon: LucideIcon; group: RailGroup; subgroup?: RailSubgroup };

const railGroups: Array<{ id: RailGroup; label: string | null }> = [
  { id: "architecture", label: null },
  { id: "data-access", label: null },
  { id: "auth", label: null },
  { id: "catalog", label: null },
  { id: "admin", label: null },
  { id: "storefront", label: null },
  { id: "commerce", label: null },
  { id: "quality", label: null },
  { id: "devops", label: null },
];
const railItems: RailItem[] = [
  { label: "시스템 구성", icon: Workflow, group: "architecture", subgroup: "architecture" },
  { label: "도메인 설계", icon: Boxes, group: "architecture", subgroup: "architecture" },
  { label: "API 규칙", icon: BookOpen, group: "architecture", subgroup: "architecture" },
  { label: "백엔드·프론트 구조", icon: Code2, group: "architecture", subgroup: "architecture" },
  { label: "JPA 기본", icon: Database, group: "data-access", subgroup: "data-access" },
  { label: "스프링 시큐리티", icon: ShieldCheck, group: "auth", subgroup: "auth" },
  { label: "회원가입", icon: User, group: "auth", subgroup: "auth" },
  { label: "로그인·로그아웃", icon: LogOut, group: "auth", subgroup: "auth" },
  { label: "권한·역할", icon: LockKeyhole, group: "auth", subgroup: "auth" },
  { label: "세션·토큰", icon: KeyRound, group: "auth", subgroup: "auth" },
  { label: "메뉴 관리", icon: LayoutDashboard, group: "catalog", subgroup: "catalog" },
  { label: "카테고리", icon: Boxes, group: "catalog", subgroup: "catalog" },
  { label: "상품 데이터 모델", icon: Database, group: "catalog", subgroup: "catalog" },
  { label: "PostgreSQL·마이그레이션", icon: Database, group: "catalog", subgroup: "catalog" },
  { label: "관리자 레이아웃", icon: LayoutDashboard, group: "admin", subgroup: "admin" },
  { label: "상품 관리", icon: Boxes, group: "admin", subgroup: "admin" },
  { label: "재고 관리", icon: Database, group: "admin", subgroup: "admin" },
  { label: "주문 관리", icon: ClipboardList, group: "admin", subgroup: "admin" },
  { label: "회원 관리", icon: User, group: "admin", subgroup: "admin" },
  { label: "상품 목록·상세", icon: Boxes, group: "storefront", subgroup: "storefront" },
  { label: "검색·필터", icon: Search, group: "storefront", subgroup: "storefront" },
  { label: "장바구니", icon: ShoppingCart, group: "storefront", subgroup: "storefront" },
  { label: "SEO·콘텐츠", icon: PenTool, group: "storefront", subgroup: "storefront" },
  { label: "주문 생성·상태", icon: ClipboardList, group: "commerce", subgroup: "commerce" },
  { label: "결제 승인·실패·취소", icon: CreditCard, group: "commerce", subgroup: "commerce" },
  { label: "배송·주문 조회", icon: Truck, group: "commerce", subgroup: "commerce" },
  { label: "환불·부분 환불", icon: RotateCcw, group: "commerce", subgroup: "commerce" },
  { label: "재고 차감·복구", icon: PackageCheck, group: "commerce", subgroup: "commerce" },
  { label: "단위·API 테스트", icon: TestTube, group: "quality", subgroup: "quality" },
  { label: "화면·권한 테스트", icon: ShieldCheck, group: "quality", subgroup: "quality" },
  { label: "장애 시나리오", icon: AlertTriangle, group: "quality", subgroup: "quality" },
  { label: "코드 리뷰·회고", icon: BookOpen, group: "quality", subgroup: "quality" },
  { label: "로컬 개발 환경", icon: Laptop, group: "devops", subgroup: "devops" },
  { label: "Docker·CI/CD", icon: Workflow, group: "devops", subgroup: "devops" },
  { label: "배포", icon: Rocket, group: "devops", subgroup: "devops" },
  { label: "모니터링·로그", icon: Search, group: "devops", subgroup: "devops" },
  { label: "백업·복구", icon: Database, group: "devops", subgroup: "devops" },
];
const railSubgroups: Array<{ id: RailSubgroup; label: string }> = [
  { id: "architecture", label: "아키텍처·기반" },
  { id: "data-access", label: "ORM·데이터 접근" },
  { id: "auth", label: "인증·인가" },
  { id: "catalog", label: "메뉴·카테고리·DB" },
  { id: "admin", label: "관리자 페이지" },
  { id: "storefront", label: "쇼핑몰 사용자 기능" },
  { id: "commerce", label: "주문·결제·배송" },
  { id: "quality", label: "테스트·품질" },
  { id: "devops", label: "DevOps·운영" },
];
const ActiveModuleContext = createContext("노트 홈");
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
const RAIL_COLLAPSED_KEY = "pkt.study.railCollapsed.v2";

type ShellUser = {
  username: string;
  email: string;
  role: { name: string };
};

type WindowResizeDirection = "East" | "North" | "NorthEast" | "NorthWest" | "South" | "SouthEast" | "SouthWest" | "West";

const windowResizeHandles: Array<{
  direction: WindowResizeDirection;
  className: string;
  cursor: string;
}> = [
  { direction: "North", className: "inset-x-2 top-0 h-1.5", cursor: "n-resize" },
  { direction: "South", className: "inset-x-2 bottom-0 h-1.5", cursor: "s-resize" },
  { direction: "West", className: "bottom-2 left-0 top-2 w-1.5", cursor: "w-resize" },
  { direction: "East", className: "bottom-2 right-0 top-2 w-1.5", cursor: "e-resize" },
  { direction: "NorthWest", className: "left-0 top-0 size-3", cursor: "nw-resize" },
  { direction: "NorthEast", className: "right-0 top-0 size-3", cursor: "ne-resize" },
  { direction: "SouthWest", className: "bottom-0 left-0 size-3", cursor: "sw-resize" },
  { direction: "SouthEast", className: "bottom-0 right-0 size-3", cursor: "se-resize" },
];

function WindowResizeHandles() {
  const isTauri = useSyncExternalStore(
    () => () => {},
    () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window,
    () => false,
  );
  if (!isTauri) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[999]" aria-hidden="true">
      {windowResizeHandles.map(({ direction, className, cursor }) => (
        <div
          key={direction}
          className={`pointer-events-auto absolute ${className}`}
          style={{ cursor }}
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            void getCurrentWindow().startResizeDragging(direction);
          }}
        />
      ))}
    </div>
  );
}

export function useActiveModule() { return useContext(ActiveModuleContext); }

export const ShellUserContext = createContext<ShellUser | null>(null);
export function useShellUser() { return useContext(ShellUserContext); }

export function FullstackShell({ children, user }: { children: ReactNode; user: ShellUser }) {
  const [active, setActive] = useState("노트 홈");
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [selectedRailSubgroup, setSelectedRailSubgroup] = useState<RailSubgroup | null>(null);
  const [railPopoverTop, setRailPopoverTop] = useState(56);
  const [railPopoverLeft, setRailPopoverLeft] = useState(116);
  const [accountOpen, setAccountOpen] = useState(false);
  const [contentRefreshKey, setContentRefreshKey] = useState(0);
  const [isRefreshingContent, setIsRefreshingContent] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const railMenuRef = useRef<HTMLDivElement>(null);
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const applyHash = () => {
      const value = decodeURIComponent(window.location.hash.slice(1));
      if (value) setActive(value);
    };
    const initialFrame = window.requestAnimationFrame(() => {
      setRailCollapsed(window.localStorage.getItem(RAIL_COLLAPSED_KEY) === "1");
      applyHash();
    });
    window.addEventListener("hashchange", applyHash);
    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.removeEventListener("hashchange", applyHash);
    };
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    const close = (event: MouseEvent) => { if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setAccountOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [accountOpen]);

  useEffect(() => {
    if (!selectedRailSubgroup) return;
    const close = (event: MouseEvent) => {
      if (!railMenuRef.current?.contains(event.target as Node)) setSelectedRailSubgroup(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedRailSubgroup(null); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [selectedRailSubgroup]);

  useEffect(() => () => { if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current); }, []);

  const selectModule = (label: string) => {
    setActive(label);
    setSelectedRailSubgroup(null);
    window.history.replaceState(null, "", `#${encodeURIComponent(label)}`);
  };
  const openRailSubgroup = (event: ReactMouseEvent<HTMLButtonElement>, subgroup: RailSubgroup) => {
    if (selectedRailSubgroup === subgroup) {
      setSelectedRailSubgroup(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const popoverHeight = 196;
    setRailPopoverTop(Math.max(56, Math.min(rect.top - 8, window.innerHeight - popoverHeight - 16)));
    setRailPopoverLeft(rect.right + 12);
    setSelectedRailSubgroup(subgroup);
  };
  const toggleRail = () => {
    setRailCollapsed((collapsed) => {
      const next = !collapsed;
      window.localStorage.setItem(RAIL_COLLAPSED_KEY, next ? "1" : "0");
      if (next) { setAccountOpen(false); setSelectedRailSubgroup(null); }
      return next;
    });
  };
  const refreshContent = () => {
    if (isRefreshingContent) return;
    setIsRefreshingContent(true);
    setContentRefreshKey((key) => key + 1);
    refreshTimerRef.current = window.setTimeout(() => { setIsRefreshingContent(false); refreshTimerRef.current = null; }, 650);
  };
  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      // API 실패 여부와 관계없이 클라이언트 화면도 인증 화면으로 되돌린다.
      window.location.replace("/login");
    }
  };
  const railTint = (percent: number) => `color-mix(in srgb, var(--primary-foreground) ${percent}%, transparent)`;
  const activeRailSubgroup = railItems.find((item) => (item.moduleLabel ?? item.label) === active)?.subgroup;

  return (
    <ToastProvider><QueryClientProvider client={queryClient}><ShellUserContext.Provider value={user}><ActiveModuleContext.Provider value={active}><BookmarkProvider userId={user.email}>
      <div className="relative flex h-screen overflow-hidden">
        <div ref={railMenuRef} className={"relative z-50 flex shrink-0 will-change-[width] transition-[width] duration-300 ease-in-out " + (accountOpen ? "overflow-visible " : "overflow-hidden ") + (railCollapsed ? "w-0" : "w-[108px]")}>
        <nav aria-hidden={railCollapsed} className={"relative flex h-full w-[108px] shrink-0 flex-col items-center text-text-on-brand will-change-transform transition-[transform,opacity] duration-300 ease-in-out " + (railCollapsed ? "pointer-events-none -translate-x-full opacity-0" : "translate-x-0 opacity-100")} style={{ backgroundImage: "linear-gradient(180deg, var(--rail-primary) 0%, var(--rail-primary-deep) 100%)" }}>
          <button type="button" onClick={() => selectModule("노트 홈")} className="flex h-12 w-full shrink-0 items-center justify-center border-b transition-colors hover:bg-white/10" style={{ borderColor: railTint(10) }}>
            <span className="text-[10px] font-black tracking-[0.06em] text-white">BULKUP RAPTOR</span>
            <span className="sr-only">Bulkup Raptor 프로젝트 홈으로 가기</span>
          </button>
          <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto py-1">
            {railGroups.map((group, index) => <div key={group.id} className={"flex w-[100px] shrink-0 flex-col items-center gap-0.5 pb-1 pt-1" + (index > 0 ? " border-t border-white/10 mt-0.5 pt-2" : "")}>
              {group.label && <span className="pb-0.5 text-[8.5px] font-black uppercase tracking-[0.14em] text-text-on-brand/65">{group.label}</span>}
              {railSubgroups.filter((subgroup) => railItems.some((item) => item.group === group.id && item.subgroup === subgroup.id)).map((subgroup) => {
                const selected = selectedRailSubgroup === subgroup.id;
                const hasActiveChild = activeRailSubgroup === subgroup.id;
                const activeChild = railItems.find((item) => item.subgroup === subgroup.id && (item.moduleLabel ?? item.label) === active)?.label;
                return <button key={subgroup.id} type="button" onClick={(event) => openRailSubgroup(event, subgroup.id)} aria-expanded={selected} aria-controls={`rail-submenu-${subgroup.id}`} className={"flex min-h-[40px] w-[92px] flex-col items-center justify-center gap-1 px-1 py-1 transition-all duration-300 ease-in-out " + (selected ? "rounded-[13px]" : hasActiveChild ? "rounded-[13px] bg-white/10" : "rounded-[20px] hover:rounded-[13px] hover:bg-white/10")} style={{ backgroundColor: selected ? railTint(38) : undefined }}><span className="flex items-center gap-0.5 text-[10px] font-black leading-[1.15]">{subgroup.label}<ChevronDown className="size-3 -rotate-90" /></span><span className="max-w-[82px] overflow-hidden text-center text-[8px] font-medium leading-[1.1] text-text-on-brand/70 [word-break:keep-all]">{activeChild ?? "하위 메뉴"}</span></button>;
              })}
              {railItems.filter((item) => item.group === group.id && !item.subgroup).map((item) => {
                const Icon = item.icon; const moduleLabel = item.moduleLabel ?? item.label; const selected = moduleLabel === active;
                return <button key={moduleLabel} type="button" onClick={() => selectModule(moduleLabel)} title={item.label} className={"flex min-h-[40px] w-[92px] flex-col items-center justify-center gap-0.5 px-1 py-1 transition-all duration-300 ease-in-out " + (selected ? "rounded-[13px]" : "rounded-[20px] hover:rounded-[13px] hover:bg-white/10")} style={{ backgroundColor: selected ? railTint(38) : undefined }}><Icon className="size-[19px] shrink-0" strokeWidth={2} /><span className="w-full overflow-hidden text-center text-[9.5px] font-semibold leading-[1.15] [word-break:keep-all]">{item.label}</span></button>;
              })}
            </div>)}
          </div>
          <div ref={accountRef} className="relative flex min-h-[116px] w-full flex-col items-center gap-1 border-t px-2 py-2" style={{ borderColor: railTint(10) }}>
            <button type="button" onClick={() => selectModule("통합 검색")} title="전체 노트 검색" aria-label="전체 노트 검색" className={"flex h-[40px] w-[92px] items-center justify-center transition-all duration-200 " + (active === "통합 검색" ? "rounded-[13px]" : "rounded-[20px] hover:rounded-[13px] hover:bg-white/10")} style={{ backgroundColor: active === "통합 검색" ? railTint(25) : undefined }}><Search className="size-[20px]" strokeWidth={2} /></button>
            <button type="button" onClick={() => selectModule("북마크")} title="북마크" aria-label="북마크" aria-current={active === "북마크" ? "page" : undefined} className={"flex h-[40px] w-[92px] items-center justify-center transition-all duration-200 " + (active === "북마크" ? "rounded-[13px]" : "rounded-[20px] hover:rounded-[13px] hover:bg-white/10")} style={{ backgroundColor: active === "북마크" ? railTint(25) : undefined }}><Bookmark className="size-[20px]" fill={active === "북마크" ? "currentColor" : "none"} /></button>
            <button type="button" onClick={() => selectModule("설정")} title="설정" className={"flex h-[40px] w-[92px] items-center justify-center transition-all duration-200 " + (active === "설정" ? "rounded-[13px]" : "rounded-[20px] hover:rounded-[13px] hover:bg-white/10")} style={{ backgroundColor: active === "설정" ? railTint(25) : undefined }}><Settings className="size-[20px]" strokeWidth={2} /></button>
          <button type="button" onClick={() => setAccountOpen((open) => !open)} title="Bulkup Raptor 관리자" className="grid h-[40px] w-[92px] place-items-center rounded-[20px] border border-transparent p-0 transition-all hover:bg-white/20"><span className="grid h-[30px] w-[30px] place-items-center rounded-full border bg-surface-raised text-text-primary" style={{ borderColor: railTint(30) }}><User className="size-4" /></span></button>
            <span className="mt-0.5 select-none text-[8.5px] font-bold tabular-nums" style={{ color: railTint(85) }}>v{packageJson.version}</span>
            {accountOpen && <div className="absolute bottom-[52px] left-[102px] z-50 w-[200px] rounded-lg border border-surface-border bg-surface-raised p-1.5 text-text-primary shadow-xl"><div className="border-b border-surface-border-soft px-2.5 py-2"><p className="truncate text-[13px] font-black">{user.username}</p><p className="truncate text-[11px] font-semibold text-text-secondary">{user.role.name}</p><p className="truncate text-[10px] text-text-secondary">{user.email}</p></div><button type="button" onClick={() => void logout()} className="mt-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-bold text-destructive hover:bg-destructive/10"><LogOut className="size-4" /> 로그아웃</button></div>}
          </div>
        </nav>
        {selectedRailSubgroup && !railCollapsed && <aside id={`rail-submenu-${selectedRailSubgroup}`} className="fixed z-50 w-[180px] rounded-xl border border-surface-border bg-surface-raised px-2.5 py-2.5 text-text-primary shadow-xl" style={{ top: railPopoverTop, left: railPopoverLeft }}>
          <div className="mb-1.5 flex items-center justify-between rounded-lg bg-surface-muted px-2 py-1.5">
            <h2 className="text-[13px] font-black">{railSubgroups.find((subgroup) => subgroup.id === selectedRailSubgroup)?.label}</h2>
            <button type="button" onClick={() => setSelectedRailSubgroup(null)} className="grid size-5 place-items-center rounded-md text-text-muted hover:bg-surface-raised hover:text-text-primary" aria-label="2차 메뉴 닫기"><ChevronDown className="size-3 rotate-90" /></button>
          </div>
          <div className="space-y-0.5">{railItems.filter((item) => item.subgroup === selectedRailSubgroup).map((item) => {
            const Icon = item.icon; const moduleLabel = item.moduleLabel ?? item.label; const selected = moduleLabel === active;
            return <button key={moduleLabel} type="button" onClick={() => selectModule(moduleLabel)} className={"flex min-h-10 w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors " + (selected ? "bg-brand-glass text-brand-primary" : "text-text-secondary hover:bg-surface-muted hover:text-text-primary")}><Icon className="size-3.5 shrink-0" strokeWidth={2} /><span className="line-clamp-2 text-[11px] font-bold leading-tight [word-break:keep-all]">{item.label}</span></button>;
          })}</div>
        </aside>}
        </div>
        <ContentRefreshProvider value={{ refresh: refreshContent, isRefreshing: isRefreshingContent }}><RailToggleProvider value={{ collapsed: railCollapsed, toggle: toggleRail }}>
          <div key={contentRefreshKey} className={"flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-opacity duration-300 " + (isRefreshingContent ? "opacity-60" : "opacity-100")}>{children}</div>
        </RailToggleProvider></ContentRefreshProvider>
        <WindowResizeHandles />
      </div>
    </BookmarkProvider></ActiveModuleContext.Provider></ShellUserContext.Provider></QueryClientProvider></ToastProvider>
  );
}
