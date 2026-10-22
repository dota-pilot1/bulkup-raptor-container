import { useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import { PanelLeft, PanelLeftClose, RefreshCw } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useContentRefresh } from "../lib/content-refresh";
import { useRailToggle } from "../lib/rail-toggle";
import WindowControls from "./WindowControls";

const subscribeToRuntime = () => () => {};
const getTauriRuntimeSnapshot = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const getServerRuntimeSnapshot = () => false;

function isInteractive(target: EventTarget | null) {
  return (
    target instanceof Element &&
    !!target.closest("button, a, input, textarea, select, [contenteditable='true'], [data-no-drag]")
  );
}

/** 직원 콘솔 공통 상단 헤더. 빈 영역은 창 드래그/더블클릭 최대화에 쓴다. */
function PageHeader({ children, center, hideRefresh = false }: { children?: ReactNode; center?: ReactNode; hideRefresh?: boolean }) {
  const contentRefresh = useContentRefresh();
  const rail = useRailToggle();
  const isTauri = useSyncExternalStore(subscribeToRuntime, getTauriRuntimeSnapshot, getServerRuntimeSnapshot);

  const handleMouseDown = (e: MouseEvent<HTMLElement>) => {
    if (!isTauri || e.button !== 0 || isInteractive(e.target)) return;
    void getCurrentWindow().startDragging();
  };

  const handleDoubleClick = (e: MouseEvent<HTMLElement>) => {
    if (!isTauri || isInteractive(e.target)) return;
    void getCurrentWindow().toggleMaximize();
  };

  return (
    <header
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      className="relative flex h-12 shrink-0 select-none items-center gap-2.5 border-b border-surface-border-soft bg-surface-raised px-4 shadow-sm"
    >
      {rail && (
        <button
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={rail.toggle}
          title={rail.collapsed ? "사이드바 열기 (본문 복원)" : "사이드바 접기 (본문 전체 확대)"}
          aria-label={rail.collapsed ? "사이드바 열기" : "사이드바 접기"}
          aria-expanded={!rail.collapsed}
          className="ui-icon-button -ml-1 h-7 w-7 shrink-0"
        >
          {rail.collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      )}
      {/* children 안에도 ml-auto 우측 버튼이 있어서, 자동 여백이 창 버튼과 공간을 나눠 갖지 않도록 한 겹 감싼다. */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {children}
        {contentRefresh && !hideRefresh && (
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={contentRefresh.refresh}
            disabled={contentRefresh.isRefreshing}
            className="ui-icon-button ml-1 h-7 w-7 shrink-0"
            title="본문 새로고침"
            aria-label="본문 새로고침"
          >
            <RefreshCw className={`size-3.5 ${contentRefresh.isRefreshing ? "refresh-icon-spin" : ""}`} />
          </button>
        )}
      </div>
      {center && <div className="absolute left-1/2 top-1/2 flex w-[min(46vw,42rem)] -translate-x-1/2 -translate-y-1/2 items-center">{center}</div>}
      {/* 창 조작 버튼은 헤더 오른쪽 끝에서 실제로 자리를 차지한다(예전 absolute 오버레이는 화면별 우측 버튼과 겹쳤다). */}
      {isTauri && (
        <div className="flex shrink-0 items-center self-stretch border-l border-surface-border-soft pl-2.5">
          <WindowControls />
        </div>
      )}
    </header>
  );
}

export default PageHeader;
