import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FolderInput,
  GripVertical,
  LockKeyhole,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";

export type ListColumnItem = {
  id: number;
  title: string;
  badge?: ReactNode;
  count?: number;
};

type MoveTargetMode = {
  title: string;
  sourceId: number;
  moving: boolean;
  onCancel: () => void;
  onMoveTo: (id: number) => void;
};

function SortableColumnItem({
  id,
  index,
  disabled,
  children,
}: {
  id: number;
  index: number;
  disabled: boolean;
  children: (sortable: ReturnType<typeof useSortable>) => ReactNode;
}) {
  const sortable = useSortable({
    id,
    index,
    type: "playbook-list-item",
    disabled,
  });
  return children(sortable);
}

/**
 * MES 학습 노트 좌측 2개 컬럼(1차 영역 / 2차 주제)의 공통 골격.
 * 참조앱의 3단 레이아웃에서 반복되던 "헤더 + 개수 + 추가 버튼 + 항목 리스트"를 하나로 묶었다.
 */
function ListColumn({
  title,
  items,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onMove,
  onDelete,
  onReorder,
  emptyLabel,
  createPlaceholder,
  disabled = false,
  collapsed = false,
  expandedWidth,
  onToggle,
  protectedStructure = false,
  moveTargetMode,
}: {
  title: string;
  items: ListColumnItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreate: (title: string) => void;
  onRename: (id: number, title: string) => void;
  onMove?: (id: number) => void;
  onDelete: (id: number) => void;
  onReorder: (ids: number[]) => void;
  emptyLabel: string;
  createPlaceholder: string;
  disabled?: boolean;
  collapsed?: boolean;
  /** 펼친 상태의 컬럼 폭. 접히는 동안 목록이 눌리지 않게 안쪽 폭을 이 값으로 고정한다. */
  expandedWidth: number;
  onToggle: () => void;
  /** 코드 갤러리의 고정 1·2차 구조는 일반 노트처럼 변경하지 않는다. */
  protectedStructure?: boolean;
  /** 2차 메뉴 이동 시, 이 목록을 목적지 선택기로 전환한다. */
  moveTargetMode?: MoveTargetMode;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [menu, setMenu] = useState<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menu]);

  const openMenu = (id: number, x: number, y: number) => {
    const menuWidth = 168;
    const menuHeight = onMove ? 124 : 86;
    setMenu({
      id,
      x: Math.max(8, Math.min(x, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - menuHeight - 8)),
    });
  };

  const submit = () => {
    const value = draft.trim();
    if (value) onCreate(value);
    setDraft("");
    setAdding(false);
  };

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-surface-border bg-surface-raised shadow-sm">
      {/* 접힘/펼침 헤더를 겹쳐 두고 투명도만 바꾼다. 마크업을 갈아치우면 폭이 줄기 전에 내용이 튄다. */}
      <div className="relative flex h-12 min-h-12 shrink-0 items-center border-b border-surface-border-soft bg-surface-muted/30">
        <div
          aria-hidden={!collapsed}
          className={
            "absolute inset-0 flex items-center justify-center gap-2 px-2 transition-opacity duration-150 " +
            (collapsed ? "opacity-100" : "pointer-events-none opacity-0")
          }
        >
          <span className="whitespace-nowrap text-xs font-black text-text-primary">
            {title}
          </span>
          <span
            className="grid min-w-5 place-items-center rounded-full border border-brand-border/40 bg-brand-glass px-1.5 py-0.5 text-[10px] font-black tabular-nums text-brand-primary"
            title={`${items.length}개`}
          >
            {items.length}
          </span>
          <button
            type="button"
            onClick={onToggle}
            tabIndex={collapsed ? 0 : -1}
            aria-expanded={false}
            aria-label={`${title} 펼치기`}
            title={`${title} 펼치기`}
            className="ui-icon-button size-7 text-brand-primary"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div
          aria-hidden={collapsed}
          className={
            "absolute inset-0 flex items-center gap-2 px-3 transition-opacity duration-150 " +
            (collapsed ? "pointer-events-none opacity-0" : "opacity-100")
          }
        >
          <h2 className="min-w-0 truncate text-sm font-black text-text-primary">
            {moveTargetMode ? `${moveTargetMode.title} 이동` : title}
          </h2>
          {protectedStructure && !moveTargetMode && (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-border/50 bg-brand-glass px-1.5 py-0.5 text-[10px] font-black text-brand-primary"
              title="공통 UI 시스템 갤러리 고정 구조"
            >
              <LockKeyhole className="size-3" /> 시스템
            </span>
          )}
          {!moveTargetMode && <span
            className="grid min-w-5 place-items-center rounded-full border border-brand-border/40 bg-brand-glass px-1.5 py-0.5 text-[10px] font-black tabular-nums text-brand-primary"
            title={`${items.length}개`}
          >
            {items.length}
          </span>}
          <span className="flex-1" />
          {moveTargetMode ? (
            <button
              type="button"
              onClick={moveTargetMode.onCancel}
              disabled={moveTargetMode.moving}
              className="ui-icon-button h-7 px-2.5 text-[11px] font-black disabled:opacity-40"
            >
              취소
            </button>
          ) : <>
          <button
            type="button"
            onClick={onToggle}
            tabIndex={collapsed ? -1 : 0}
            aria-expanded={true}
            aria-label={`${title} 접기`}
            title={`${title} 접기`}
            className="ui-icon-button size-7 shrink-0 text-text-muted"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            disabled={disabled || collapsed || protectedStructure}
            tabIndex={collapsed ? -1 : 0}
            title={`${title} 추가`}
            className="ui-icon-button h-7 w-7 shrink-0 border-brand-border bg-brand-glass text-brand-primary disabled:opacity-40"
          >
            <Plus className="size-4" />
          </button>
          </>}
        </div>
      </div>

      <div
        aria-hidden={collapsed}
        className={
          "min-h-0 flex-1 overflow-hidden transition-opacity duration-150 " +
          (collapsed ? "pointer-events-none opacity-0" : "opacity-100")
        }
      >
        {/* 접히는 동안 항목이 찌그러지지 않도록 펼친 폭을 유지한 채 잘려 나가게 한다. */}
        <DragDropProvider
          onDragEnd={(event) => {
            if (moveTargetMode) return;
            if (event.canceled) return;
            const reordered = move(items, event);
            const ids = reordered.map((item) => item.id);
            if (!ids.every((id, index) => id === items[index]?.id))
              onReorder(ids);
          }}
        >
          <div
          className="grid h-full auto-rows-min content-start gap-2 overflow-y-auto p-2.5"
            style={{ width: expandedWidth }}
          >
            {items.length === 0 && !adding && (
              <p className="px-1 py-6 text-center text-[13px] font-semibold text-text-muted">
                {emptyLabel}
              </p>
            )}

            {items.map((item, index) => {
              const isActive = item.id === selectedId;
              const editing = editingId === item.id;
              return (
                <SortableColumnItem
                  key={item.id}
                  id={item.id}
                  index={index}
                  disabled={protectedStructure || Boolean(moveTargetMode)}
                >
                  {({ ref, handleRef, isDragSource, isDropTarget }) => (
                    <div
                      ref={ref}
                      data-playbook-menu={`${title}:${item.id}`}
                      onClick={() => {
                        if (editing) return;
                        if (moveTargetMode) {
                          if (item.id !== moveTargetMode.sourceId) moveTargetMode.onMoveTo(item.id);
                          return;
                        }
                        onSelect(item.id);
                      }}
                      onContextMenu={(event) => {
                        if (protectedStructure || moveTargetMode || editing) return;
                        event.preventDefault();
                        event.stopPropagation();
                        openMenu(item.id, event.clientX, event.clientY);
                      }}
                      className={
                        "flex min-h-12 cursor-pointer items-center gap-2 rounded-md border px-2.5 transition-all duration-150 " +
                        (moveTargetMode
                          ? item.id === moveTargetMode.sourceId
                            ? "cursor-default border-surface-border-soft bg-surface-muted opacity-65"
                            : "cursor-pointer border-brand-border bg-surface-raised hover:bg-brand-glass"
                          : isDragSource
                          ? "opacity-40"
                          : isDropTarget
                            ? "border-brand-primary bg-brand-glass ring-1 ring-brand-primary/30"
                            : isActive
                              ? "border-brand-border bg-brand-glass"
                              : "border-surface-border-soft bg-surface-muted hover:border-brand-border")
                      }
                    >
                      {moveTargetMode ? (
                        <span className="grid size-6 shrink-0 place-items-center text-brand-primary">
                          {item.id === moveTargetMode.sourceId ? <span className="size-1.5 rounded-full bg-text-muted" /> : <ArrowRight className="size-4" />}
                        </span>
                      ) : (
                        <button
                          ref={handleRef}
                          type="button"
                          onClick={(event) => event.stopPropagation()}
                          className="grid size-6 shrink-0 cursor-grab place-items-center text-text-muted active:cursor-grabbing"
                          aria-label={`${item.title} 순서 변경`}
                        >
                          <GripVertical className="size-4 shrink-0 cursor-grab text-text-muted" />
                        </button>
                      )}
                      {item.badge}
                      {editing ? (
                        <input
                          autoFocus
                          value={editingTitle}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            setEditingTitle(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && editingTitle.trim()) {
                              onRename(item.id, editingTitle.trim());
                              setEditingId(null);
                            }
                            if (event.key === "Escape") setEditingId(null);
                          }}
                          onBlur={() => {
                            if (
                              editingTitle.trim() &&
                              editingTitle.trim() !== item.title
                            )
                              onRename(item.id, editingTitle.trim());
                            setEditingId(null);
                          }}
                          className="ui-input h-8 min-w-0 flex-1 px-2 text-sm font-bold"
                        />
                      ) : (
                        <button
                          type="button"
                          onDoubleClick={(event) => {
                            if (protectedStructure || moveTargetMode) return;
                            event.stopPropagation();
                            setEditingId(item.id);
                            setEditingTitle(item.title);
                          }}
                          className={
                            "min-w-0 flex-1 truncate text-left text-sm font-black " +
                            (isActive
                              ? "text-text-primary"
                              : "text-text-secondary")
                          }
                          title="더블클릭하여 이름 수정"
                        >
                          {item.title}
                        </button>
                      )}
                      {item.count !== undefined && !moveTargetMode && (
                        <span
                          className="shrink-0 rounded-full bg-surface-raised px-2 py-1 text-[10px] font-black tabular-nums text-text-muted"
                          title={`${item.count}개`}
                        >
                          {item.count}개
                        </span>
                      )}
                      {moveTargetMode ? (
                        <span className={"shrink-0 text-[11px] font-black " + (item.id === moveTargetMode.sourceId ? "text-text-muted" : "text-brand-primary")}>
                          {item.id === moveTargetMode.sourceId ? "현재 위치" : "여기로 이동"}
                        </span>
                      ) : !protectedStructure ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            openMenu(item.id, rect.right - 168, rect.bottom + 4);
                          }}
                          title="메뉴 관리"
                          aria-label={`${item.title} 메뉴 관리`}
                          aria-haspopup="menu"
                          aria-expanded={menu?.id === item.id}
                          className="ui-icon-button size-7 shrink-0 text-text-muted"
                        >
                          <MoreVertical className="size-3.5" />
                        </button>
                      ) : (
                        <span
                          className="grid size-7 shrink-0 place-items-center text-brand-primary"
                          title="시스템 갤러리 구조는 삭제할 수 없습니다."
                        >
                          <LockKeyhole className="size-3.5" />
                        </span>
                      )}
                      {menu?.id === item.id && (
                        <div
                          role="menu"
                          onClick={(event) => event.stopPropagation()}
                          className="fixed z-[130] w-[168px] rounded-lg border border-surface-border bg-surface-raised p-1.5 text-text-primary shadow-2xl"
                          style={{ left: menu.x, top: menu.y }}
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setEditingId(item.id);
                              setEditingTitle(item.title);
                              setMenu(null);
                            }}
                            className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-bold hover:bg-surface-muted"
                          >
                            <Pencil className="size-3.5" /> 이름 변경
                          </button>
                          {onMove && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                onMove(item.id);
                                setMenu(null);
                              }}
                              className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-bold hover:bg-surface-muted"
                            >
                              <FolderInput className="size-3.5" /> 다른 1차 메뉴로 이동
                            </button>
                          )}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              onDelete(item.id);
                              setMenu(null);
                            }}
                            className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-bold text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-3.5" /> 삭제
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </SortableColumnItem>
              );
            })}

            {adding && (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={submit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") {
                    setDraft("");
                    setAdding(false);
                  }
                }}
                placeholder={createPlaceholder}
                className="ui-input"
              />
            )}
          </div>
        </DragDropProvider>
      </div>
    </section>
  );
}

export default ListColumn;
