/* eslint-disable react-hooks/set-state-in-effect -- 선택한 작업의 편집 초안과 드로어 닫힘 상태를 동기화한다. */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import { DragDropProvider } from "@dnd-kit/react";
import { move } from "@dnd-kit/helpers";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardCopy,
  Download,
  FileCode2,
  FolderOpen,
  GripVertical,
  ListTodo,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {
  STATUS_META,
  TODO_STATUSES,
  TASK_WORKSTREAMS,
  WORKSTREAM_META,
  type TodoApiSpec,
  type TodoChecklistItem,
  type TodoItem,
  type TodoScope,
  type TodoStatus,
  type TodoVerificationCheck,
  type TodoWorkstream,
} from "./types";
import { useTodos } from "./useTodos";
import { copyToClipboard } from "@/shared/lib/clipboard";
import { CompactSelect } from "@/shared/ui/compact-select";
import { HttpMethodBadge, HttpMethodSelect, type HttpMethod } from "@/shared/ui/http-method";
import { useToast } from "@/shared/ui/toast";

type StatusFilter = "ALL" | TodoStatus;

const TODO_DRAWER_SIZE_KEY = "pkt-study-todo-drawer-size-v2";
const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const TODO_DRAWER_SIZES = [
  { label: "S", value: 40 },
  { label: "M", value: 60 },
  { label: "L", value: 80 },
  { label: "XL", value: 92 },
] as const;

function SortableTodoRow({
  todo,
  index,
  disabled,
  children,
}: {
  todo: TodoItem;
  index: number;
  disabled: boolean;
  children: (sortable: ReturnType<typeof useSortable>) => ReactNode;
}) {
  const sortable = useSortable({
    id: todo.id,
    index,
    type: "todo-list-item",
    disabled,
  });
  return children(sortable);
}

function SortableChecklistRow({
  item,
  index,
  children,
}: {
  item: TodoChecklistItem;
  index: number;
  children: (sortable: ReturnType<typeof useSortable>) => ReactNode;
}) {
  const sortable = useSortable({
    id: item.id,
    index,
    type: "todo-checklist-item",
  });
  return children(sortable);
}

function storedTodoDrawerSize() {
  if (typeof window === "undefined") return 60;
  const value = Number(window.localStorage.getItem(TODO_DRAWER_SIZE_KEY));
  return TODO_DRAWER_SIZES.some((size) => size.value === value) ? value : 60;
}

function scopeTitle(scope?: TodoScope) {
  if (scope?.spaceTitle) return scope.spaceTitle;
  if (!scope?.topicTitle) return "공통 작업";
  return [scope.categoryTitle, scope.topicTitle].filter(Boolean).join(" · ");
}

function agentTargetFolderStorageKey(scope?: TodoScope) {
  return [
    "pkt-study-agent-target-folder-v2",
    scope?.spaceCode ?? "COMMON",
  ].join(":");
}

function savedAgentTargetFolder(scope?: TodoScope) {
  if (typeof window === "undefined") return "";
  const key = agentTargetFolderStorageKey(scope);
  const saved = window.localStorage.getItem(key);
  if (saved !== null) return saved;

  // 이전 버전은 1·2차 메뉴마다 폴더를 따로 저장했다. 현재 메뉴에 저장된
  // 값을 작업 영역 공통 기본값으로 한 번 옮겨, 기존 사용자의 설정도 유지한다.
  const legacyKey = [
    "pkt-study-agent-target-folder-v1",
    scope?.spaceCode ?? "COMMON",
    scope?.categoryId ?? "none",
    scope?.topicId ?? "none",
  ].join(":");
  const legacy = window.localStorage.getItem(legacyKey) ?? "";
  if (legacy) window.localStorage.setItem(key, legacy);
  return legacy;
}

function TodoDetail({
  todo,
  isClosing,
  onClose,
  onSave,
  onRefresh,
  onDelete,
}: {
  todo: TodoItem;
  isClosing: boolean;
  onClose: () => void;
  onSave: (patch: Partial<TodoItem>) => Promise<unknown>;
  onRefresh: () => Promise<unknown>;
  onDelete: () => Promise<boolean>;
}) {
  const { showToast } = useToast();
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description);
  const [checklist, setChecklist] = useState(todo.checklist);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [newChecklistLayer, setNewChecklistLayer] = useState("");
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(
    null,
  );
  const [isChecklistBulkEditing, setIsChecklistBulkEditing] = useState(false);
  const [verificationChecks, setVerificationChecks] = useState(
    todo.verificationChecks,
  );
  const [apiSpecs, setApiSpecs] = useState(todo.apiSpecs);
  const [newApiMethod, setNewApiMethod] =
    useState<TodoApiSpec["method"]>("GET");
  const [newApiPath, setNewApiPath] = useState("");
  const [newApiPurpose, setNewApiPurpose] = useState("");
  const [newVerificationCheck, setNewVerificationCheck] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [agentGuideOpen, setAgentGuideOpen] = useState(false);
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    setTitle(todo.title);
    setDescription(todo.description);
    setChecklist(todo.checklist);
    setVerificationChecks(todo.verificationChecks);
    setApiSpecs(todo.apiSpecs);
    setEditingChecklistId(null);
    setIsChecklistBulkEditing(false);
  }, [todo]);

  const closeDetail = useCallback(() => {
    if (!isClosing) onClose();
  }, [isClosing, onClose]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      // 중첩된 다이얼로그가 열려 있으면 가장 위의 화면부터 한 단계씩 닫는다.
      if (reviewOpen) {
        event.preventDefault();
        setReviewOpen(false);
        return;
      }
      if (instructionOpen) {
        event.preventDefault();
        setInstructionOpen(false);
        return;
      }
      if (agentGuideOpen) {
        event.preventDefault();
        setAgentGuideOpen(false);
        return;
      }

      event.preventDefault();
      closeDetail();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [agentGuideOpen, closeDetail, instructionOpen, reviewOpen]);

  const save = async () => {
    setSaving(true);
    try {
      const normalizedTitle = title.trim();
      if (!normalizedTitle) {
        showToast("작업 제목을 입력해 주세요.");
        return;
      }
      const saved = await onSave({
        title: normalizedTitle,
        description,
        checklist,
        apiSpecs,
        verificationChecks,
      });
      if (saved) showToast("작업을 저장했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const refresh = async () => {
    const startedAt = performance.now();
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      // 로컬 SQLite 조회는 즉시 끝나므로, 다른 헤더의 새로 고침과 동일하게
      // 짧은 회전 피드백을 유지해 클릭 결과를 분명하게 보여 준다.
      const remaining = 650 - (performance.now() - startedAt);
      if (remaining > 0)
        await new Promise((resolve) => window.setTimeout(resolve, remaining));
      setRefreshing(false);
    }
  };

  const remove = async () => {
    if (
      !window.confirm(
        `“${todo.title}” 작업을 삭제할까요?\n삭제한 작업은 복구할 수 없습니다.`,
      )
    )
      return;
    setDeleting(true);
    try {
      if (await onDelete()) closeDetail();
    } finally {
      setDeleting(false);
    }
  };

  const persistVerificationChecks = async (
    nextChecks: TodoVerificationCheck[],
    successMessage: string,
  ) => {
    setVerificationChecks(nextChecks);
    const saved = await onSave({ verificationChecks: nextChecks });
    if (saved) showToast(successMessage);
    else setVerificationChecks(todo.verificationChecks);
  };

  const persistApiSpecs = async (
    nextSpecs: TodoApiSpec[],
    successMessage: string,
  ) => {
    setApiSpecs(nextSpecs);
    const saved = await onSave({ apiSpecs: nextSpecs });
    if (saved) showToast(successMessage);
    else setApiSpecs(todo.apiSpecs);
  };

  const moveVerificationCheck = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= verificationChecks.length) return;
    const next = [...verificationChecks];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    await persistVerificationChecks(next, "검증 조건 순서를 변경했습니다.");
  };

  const removeChecklistItem = async (item: TodoChecklistItem) => {
    const nextChecklist = checklist.filter((current) => current.id !== item.id);
    setChecklist(nextChecklist);
    setEditingChecklistId((id) => (id === item.id ? null : id));
    const saved = await onSave({ checklist: nextChecklist });
    if (saved) showToast("세부 계획을 삭제했습니다.");
    else setChecklist(todo.checklist);
  };

  const saveChecklistItem = async () => {
    const saved = await onSave({ checklist });
    if (saved) {
      setEditingChecklistId(null);
      showToast("세부 계획을 수정했습니다.");
    } else {
      setChecklist(todo.checklist);
    }
  };

  return (
    <section
      className={`absolute inset-0 z-40 flex flex-col bg-surface-raised will-change-transform ${isClosing ? "animate-drawer-slide-out" : "animate-drawer-slide-in"}`}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-surface-border-soft px-5 py-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-black text-text-primary">
            {title || "작업 편집"}
          </h3>
          <p className="mt-0.5 text-[10px] text-text-muted">
            v{todo.version} ·{" "}
            {todo.updatedByType === "AGENT" ? "Agent 수정" : "사용자 수정"} ·{" "}
            {new Date(todo.updatedAt).toLocaleString("ko-KR")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            title="최신 작업 정보 새로 고침"
            aria-label="최신 작업 정보 새로 고침"
            className="ui-icon-button size-8 text-text-muted hover:text-brand-primary disabled:cursor-wait disabled:opacity-50"
          >
            <RefreshCw
              className={`size-4 ${refreshing ? "refresh-icon-spin" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={deleting}
            title="작업 삭제"
            aria-label="작업 삭제"
            className="ui-icon-button size-8 text-text-muted hover:text-destructive disabled:cursor-wait disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setAgentGuideOpen(true)}
            className="inline-flex h-8 items-center rounded-md border border-brand-border bg-brand-glass px-3 text-xs font-black text-brand-primary hover:bg-brand-primary/10"
          >
            세부 계획 요청 {"{}"}
          </button>
          <button
            type="button"
            onClick={closeDetail}
            className="ui-icon-button size-8 text-text-muted"
            aria-label="상세 닫기"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-6xl space-y-5">
          <label className="block">
            <span className="mb-1 block text-[10px] font-black text-text-secondary">
              작업 제목
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="작업 제목"
              className="h-10 w-full rounded-lg border border-surface-border bg-surface-raised px-3 text-sm font-bold text-text-primary outline-none focus:border-brand-border"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-black text-text-secondary">
              작업 설명{" "}
              <span className="font-medium text-text-muted">(선택)</span>
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="구현 범위와 작업 목적"
              className="min-h-28 w-full resize-y rounded-lg border border-surface-border bg-surface-raised p-3 text-xs leading-5 text-text-primary outline-none focus:border-brand-border"
            />
          </label>

          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-text-primary">
                  세부 계획
                </p>
                <p className="mt-0.5 text-[10px] text-text-muted">
                  평소에는 행 단위로 수정하고, 순서·항목을 함께 바꿀 때만 전체
                  수정 모드를 사용합니다.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsChecklistBulkEditing((value) => !value);
                    setEditingChecklistId(null);
                  }}
                  className={`inline-flex h-8 items-center rounded-md border px-2.5 text-[10px] font-black ${isChecklistBulkEditing ? "border-brand-primary bg-brand-primary text-white" : "border-surface-border bg-surface-raised text-text-secondary hover:border-brand-border hover:text-brand-primary"}`}
                >
                  {isChecklistBulkEditing ? "전체 수정 완료" : "계획 전체 수정"}
                </button>
                <button
                  type="button"
                  onClick={() => setReviewOpen(true)}
                  className="inline-flex h-8 items-center rounded-md border border-surface-border bg-surface-raised px-2.5 text-[10px] font-black text-text-secondary hover:border-brand-border hover:text-brand-primary"
                >
                  리뷰 {"{}"}
                </button>
                <button
                  type="button"
                  onClick={() => setInstructionOpen(true)}
                  className="inline-flex h-8 items-center rounded-md border border-brand-border bg-brand-glass px-2.5 text-[10px] font-black text-brand-primary hover:bg-brand-primary/10"
                >
                  지시 {"{}"}
                </button>
                <span className="inline-flex h-8 items-center rounded-full bg-surface-muted px-2 text-[10px] font-black text-text-secondary">
                  {checklist.filter((item) => item.completed).length}/
                  {checklist.length}
                </span>
              </div>
            </div>
            <DragDropProvider
              onDragEnd={(event) => {
                if (event.canceled) return;
                const reordered = move(checklist, event);
                if (
                  !reordered.every(
                    (item, index) => item.id === checklist[index]?.id,
                  )
                )
                  setChecklist(reordered);
              }}
            >
              <div className="space-y-2">
                {checklist.map((item, index) => {
                  const isEditingRow =
                    isChecklistBulkEditing || editingChecklistId === item.id;
                  return (
                    <SortableChecklistRow
                      key={item.id}
                      item={item}
                      index={index}
                    >
                      {({ ref, handleRef, isDragSource }) => (
                        <div
                          ref={ref}
                          className={`flex items-center gap-3 rounded-lg border border-surface-border-soft px-4 py-3.5 text-xs leading-5 text-text-secondary hover:bg-surface-muted/50 ${isDragSource ? "opacity-55 ring-2 ring-brand-border/50" : ""}`}
                        >
                          {isChecklistBulkEditing && (
                            <button
                              type="button"
                              ref={handleRef}
                              title="드래그하여 계획 순서 변경"
                              aria-label={`${item.text} 드래그`}
                              className="grid size-5 shrink-0 cursor-grab touch-none place-items-center self-center text-text-muted hover:text-brand-primary active:cursor-grabbing"
                            >
                              <GripVertical className="size-4" />
                            </button>
                          )}
                          <span className="grid size-5 shrink-0 place-items-center self-center rounded-full bg-brand-glass text-[10px] font-black leading-none text-brand-primary">
                            {index + 1}
                          </span>
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() =>
                              setChecklist((items) =>
                                items.map((current) =>
                                  current.id === item.id
                                    ? {
                                        ...current,
                                        completed: !current.completed,
                                      }
                                    : current,
                                ),
                              )
                            }
                            className="size-4 self-center accent-brand-primary"
                          />
                          {isEditingRow ? (
                            <input
                              value={item.text}
                              onChange={(event) =>
                                setChecklist((items) =>
                                  items.map((current) =>
                                    current.id === item.id
                                      ? { ...current, text: event.target.value }
                                      : current,
                                  ),
                                )
                              }
                              aria-label="세부 계획 내용"
                              className="h-8 min-w-0 flex-1 rounded-md border border-surface-border bg-surface-raised px-2 text-xs text-text-primary outline-none focus:border-brand-border"
                            />
                          ) : (
                            <span
                              className={`flex min-h-6 min-w-0 flex-1 items-center leading-5 ${item.completed ? "line-through text-text-muted" : ""}`}
                            >
                              {item.text}
                            </span>
                          )}
                          {isEditingRow ? (
                            <input
                              value={item.layer === "기타" ? "" : item.layer}
                              onChange={(event) =>
                                setChecklist((items) =>
                                  items.map((current) =>
                                    current.id === item.id
                                      ? {
                                          ...current,
                                          layer: event.target.value,
                                        }
                                      : current,
                                  ),
                                )
                              }
                              aria-label="구현 영역"
                              placeholder="영역"
                              className="h-7 w-28 shrink-0 self-center rounded-md border border-surface-border bg-surface-raised px-2 text-[10px] font-bold text-brand-primary outline-none focus:border-brand-border"
                            />
                          ) : (
                            <span className="w-28 shrink-0 truncate self-center rounded-md border border-surface-border bg-surface-muted px-2 py-1 text-[10px] font-black text-brand-primary">
                              {item.layer === "기타" ? "미분류" : item.layer}
                            </span>
                          )}
                          {isChecklistBulkEditing ? (
                            <button
                              type="button"
                              onClick={() => void removeChecklistItem(item)}
                              className="ui-icon-button size-7 shrink-0 self-center text-text-muted hover:text-destructive"
                              aria-label="세부 계획 삭제"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          ) : (
                            <div className="flex shrink-0 items-center gap-1 self-center">
                              <button
                                type="button"
                                onClick={() =>
                                  editingChecklistId === item.id
                                    ? void saveChecklistItem()
                                    : setEditingChecklistId(item.id)
                                }
                                className="ui-icon-button size-7 text-text-muted hover:text-brand-primary"
                                aria-label={
                                  editingChecklistId === item.id
                                    ? "세부 계획 수정 저장"
                                    : "세부 계획 수정"
                                }
                              >
                                {editingChecklistId === item.id ? (
                                  <Check className="size-3.5" />
                                ) : (
                                  <Pencil className="size-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => void removeChecklistItem(item)}
                                className="ui-icon-button size-7 text-text-muted hover:text-destructive"
                                aria-label="세부 계획 삭제"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </SortableChecklistRow>
                  );
                })}
              </div>
            </DragDropProvider>
            {checklist.length === 0 && (
              <p className="mt-2 rounded-lg border border-dashed border-surface-border px-3 py-4 text-center text-[11px] text-text-muted">
                아직 등록된 세부 계획이 없습니다.
              </p>
            )}
            {isChecklistBulkEditing && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = newChecklistItem.trim();
                  if (!value) return;
                  setChecklist((items) => [
                    ...items,
                    {
                      id: `step-${Date.now()}`,
                      text: value,
                      completed: false,
                      layer: newChecklistLayer.trim() || "기타",
                    },
                  ]);
                  setNewChecklistItem("");
                  setNewChecklistLayer("");
                }}
                className="mt-3 flex gap-2"
              >
                <input
                  value={newChecklistItem}
                  onChange={(event) => setNewChecklistItem(event.target.value)}
                  placeholder="예: 요청 DTO와 입력 검증을 구현한다"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-surface-border bg-surface-muted px-3 text-xs outline-none focus:border-brand-border"
                />
                <input
                  value={newChecklistLayer}
                  onChange={(event) => setNewChecklistLayer(event.target.value)}
                  aria-label="새 계획의 작업 영역"
                  placeholder="예: Controller"
                  className="h-9 w-28 shrink-0 rounded-lg border border-surface-border bg-surface-muted px-2 text-[11px] font-bold text-brand-primary outline-none focus:border-brand-border"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-surface-muted px-3 text-[11px] font-black text-text-secondary hover:border-brand-border hover:text-brand-primary"
                >
                  계획 추가
                </button>
              </form>
            )}
          </div>

          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-text-primary">관련 API</p>
                <p className="mt-0.5 text-[10px] text-text-muted">
                  이번 작업에서 만들거나 프론트가 호출할 API를 적습니다. API가
                  없는 작업이면 비워 두어도 됩니다.
                </p>
              </div>
              <span className="rounded-full bg-surface-muted px-2 py-1 text-[10px] font-black text-text-secondary">
                {apiSpecs.filter((item) => item.implemented).length}/
                {apiSpecs.length} 구현
              </span>
            </div>
            <div className="space-y-2">
              {apiSpecs.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-surface-border-soft px-3.5 py-3"
                >
                  <HttpMethodSelect
                    value={item.method}
                    onChange={(event) =>
                      void persistApiSpecs(
                        apiSpecs.map((current) =>
                          current.id === item.id
                            ? {
                                ...current,
                                method: event.target
                                  .value as TodoApiSpec["method"],
                              }
                            : current,
                        ),
                        "API 정보를 수정했습니다.",
                      )
                    }
                    aria-label="API 메서드"
                  />
                  <input
                    value={item.path}
                    onChange={(event) =>
                      setApiSpecs((items) =>
                        items.map((current) =>
                          current.id === item.id
                            ? { ...current, path: event.target.value }
                            : current,
                        ),
                      )
                    }
                    onBlur={() =>
                      void persistApiSpecs(apiSpecs, "API 경로를 수정했습니다.")
                    }
                    aria-label="API 경로"
                    className="h-8 min-w-40 flex-1 rounded-md border border-surface-border bg-surface-raised px-2 font-mono text-xs"
                  />
                  <input
                    value={item.purpose}
                    onChange={(event) =>
                      setApiSpecs((items) =>
                        items.map((current) =>
                          current.id === item.id
                            ? { ...current, purpose: event.target.value }
                            : current,
                        ),
                      )
                    }
                    onBlur={() =>
                      void persistApiSpecs(apiSpecs, "API 설명을 수정했습니다.")
                    }
                    aria-label="API 설명"
                    className="h-8 min-w-40 flex-1 rounded-md border border-surface-border bg-surface-raised px-2 text-xs"
                  />
                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted">
                    <input
                      type="checkbox"
                      checked={item.implemented}
                      onChange={() =>
                        void persistApiSpecs(
                          apiSpecs.map((current) =>
                            current.id === item.id
                              ? {
                                  ...current,
                                  implemented: !current.implemented,
                                }
                              : current,
                          ),
                          "API 구현 상태를 저장했습니다.",
                        )
                      }
                      className="size-4 accent-brand-primary"
                    />
                    구현
                  </label>
                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted">
                    <input
                      type="checkbox"
                      checked={item.tested}
                      onChange={() =>
                        void persistApiSpecs(
                          apiSpecs.map((current) =>
                            current.id === item.id
                              ? { ...current, tested: !current.tested }
                              : current,
                          ),
                          "API 테스트 상태를 저장했습니다.",
                        )
                      }
                      className="size-4 accent-brand-primary"
                    />
                    테스트
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      void persistApiSpecs(
                        apiSpecs.filter((current) => current.id !== item.id),
                        "관련 API를 삭제했습니다.",
                      )
                    }
                    className="ui-icon-button size-7 text-text-muted hover:text-destructive"
                    aria-label="관련 API 삭제"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
              {apiSpecs.length === 0 && (
                <p className="rounded-lg border border-dashed border-surface-border px-3 py-4 text-center text-[11px] text-text-muted">
                  아직 등록된 관련 API가 없습니다.
                </p>
              )}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const path = newApiPath.trim();
                const purpose = newApiPurpose.trim();
                if (!path || !purpose) {
                  showToast("API 경로와 설명을 모두 입력해 주세요.");
                  return;
                }
                void persistApiSpecs(
                  [
                    ...apiSpecs,
                    {
                      id: `api-${Date.now()}`,
                      method: newApiMethod,
                      path,
                      purpose,
                      implemented: false,
                      tested: false,
                    },
                  ],
                  "관련 API를 추가했습니다.",
                );
                setNewApiPath("");
                setNewApiPurpose("");
              }}
              className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-surface-border-soft px-3.5 py-3"
            >
              <HttpMethodSelect
                value={newApiMethod}
                onChange={(event) =>
                  setNewApiMethod(event.target.value as TodoApiSpec["method"])
                }
                aria-label="새 API 메서드"
              />
              <input
                value={newApiPath}
                onChange={(event) => setNewApiPath(event.target.value)}
                placeholder="/api/users"
                className="h-8 min-w-40 flex-1 rounded-md border border-surface-border bg-surface-raised px-3 font-mono text-xs"
              />
              <input
                value={newApiPurpose}
                onChange={(event) => setNewApiPurpose(event.target.value)}
                placeholder="예: 사용자 목록 보기"
                className="h-8 min-w-40 flex-1 rounded-md border border-surface-border bg-surface-raised px-3 text-xs"
              />
              <button
                type="submit"
                className="h-8 rounded-md border border-surface-border bg-surface-raised px-3 text-[11px] font-black text-text-secondary hover:border-brand-border hover:text-brand-primary"
              >
                API 추가
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-text-primary">
                  조건 검증
                </p>
                <p className="mt-0.5 text-[10px] text-text-muted">
                  구현 후 확인할 조건을 추가하고, 통과 여부와 검증 근거를
                  기록합니다.
                </p>
              </div>
              <span className="rounded-full bg-surface-muted px-2 py-1 text-[10px] font-black text-text-secondary">
                {verificationChecks.filter((item) => item.passed).length}/
                {verificationChecks.length}
              </span>
            </div>
            <div className="space-y-3">
              {verificationChecks.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-surface-border-soft px-4 py-4 text-xs text-text-secondary"
                >
                  <span className="grid size-5 shrink-0 place-items-center self-center rounded-full bg-brand-glass text-[10px] font-black leading-none text-brand-primary">
                    {index + 1}
                  </span>
                  <input
                    type="checkbox"
                    checked={item.passed}
                    onChange={() => {
                      const next = verificationChecks.map((current) =>
                        current.id === item.id
                          ? { ...current, passed: !current.passed }
                          : current,
                      );
                      void persistVerificationChecks(
                        next,
                        item.passed
                          ? "검증 조건을 미통과로 변경했습니다."
                          : "검증 조건을 통과로 변경했습니다.",
                      );
                    }}
                    aria-label={`${item.text} 통과 여부`}
                    className="size-4 self-center accent-brand-primary"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      value={item.text}
                      onChange={(event) =>
                        setVerificationChecks((items) =>
                          items.map((current) =>
                            current.id === item.id
                              ? { ...current, text: event.target.value }
                              : current,
                          ),
                        )
                      }
                      onBlur={() =>
                        void persistVerificationChecks(
                          verificationChecks,
                          "검증 조건을 수정했습니다.",
                        )
                      }
                      aria-label="검증 조건"
                      placeholder="검증 조건"
                      className="h-8 w-full rounded-md border border-surface-border bg-surface-raised px-2 text-xs text-text-primary outline-none focus:border-brand-border"
                    />
                    <input
                      value={item.evidence}
                      onChange={(event) =>
                        setVerificationChecks((items) =>
                          items.map((current) =>
                            current.id === item.id
                              ? { ...current, evidence: event.target.value }
                              : current,
                          ),
                        )
                      }
                      onBlur={() =>
                        void persistVerificationChecks(
                          verificationChecks,
                          "검증 근거를 수정했습니다.",
                        )
                      }
                      aria-label="검증 근거"
                      placeholder="테스트 결과·증빙 링크·메모 (선택)"
                      className="h-8 w-full rounded-md border border-surface-border bg-surface-raised px-2 text-[11px] text-text-secondary outline-none focus:border-brand-border"
                    />
                  </div>
                  <div className="flex shrink-0 gap-1 self-center">
                    <button
                      type="button"
                      onClick={() => void moveVerificationCheck(index, -1)}
                      disabled={index === 0}
                      className="ui-icon-button size-7 text-text-muted disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="검증 조건 위로 이동"
                    >
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void moveVerificationCheck(index, 1)}
                      disabled={index === verificationChecks.length - 1}
                      className="ui-icon-button size-7 text-text-muted disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="검증 조건 아래로 이동"
                    >
                      <ArrowDown className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void persistVerificationChecks(
                          verificationChecks.filter(
                            (current) => current.id !== item.id,
                          ),
                          "검증 조건을 삭제했습니다.",
                        )
                      }
                      className="ui-icon-button size-7 text-text-muted hover:text-destructive"
                      aria-label="검증 조건 삭제"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {verificationChecks.length === 0 && (
                <p className="rounded-lg border border-dashed border-surface-border px-3 py-4 text-center text-[11px] text-text-muted">
                  아직 등록된 검증 조건이 없습니다.
                </p>
              )}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const text = newVerificationCheck.trim();
                if (!text) return;
                const next = [
                  ...verificationChecks,
                  {
                    id: `verification-${Date.now()}`,
                    text,
                    passed: false,
                    evidence: "",
                  },
                ];
                void persistVerificationChecks(
                  next,
                  "검증 조건을 추가했습니다.",
                );
                setNewVerificationCheck("");
              }}
              className="mt-3 flex gap-2"
            >
              <input
                value={newVerificationCheck}
                onChange={(event) =>
                  setNewVerificationCheck(event.target.value)
                }
                placeholder="예: 잘못된 입력은 400 응답을 반환한다"
                className="h-9 min-w-0 flex-1 rounded-lg border border-surface-border bg-surface-muted px-3 text-xs outline-none focus:border-brand-border"
              />
              <button
                type="submit"
                className="rounded-lg bg-surface-muted px-3 text-[11px] font-black text-text-secondary hover:border-brand-border hover:text-brand-primary"
              >
                조건 추가
              </button>
            </form>
          </div>
        </div>
      </div>

      <footer className="flex shrink-0 justify-end gap-2 border-t border-surface-border-soft bg-surface-raised px-5 py-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={closeDetail}
            className="rounded-md px-2.5 py-1.5 text-[11px] font-bold text-text-muted hover:bg-surface-muted"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-md bg-brand-primary px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-50"
          >
            {saving ? "저장 중…" : "상세 저장"}
          </button>
        </div>
      </footer>
      {agentGuideOpen && (
        <AgentGuide
          scope={todo}
          todo={todo}
          workstream={todo.workstream}
          onClose={() => setAgentGuideOpen(false)}
        />
      )}
      {instructionOpen && (
        <TaskInstructionDialog
          todo={{ ...todo, title, description, checklist, verificationChecks }}
          onClose={() => setInstructionOpen(false)}
        />
      )}
      {reviewOpen && (
        <TaskReviewDialog
          todo={{ ...todo, title, description, checklist, verificationChecks }}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </section>
  );
}

type AgentEndpoint = {
  id: string;
  method: "GET" | "POST" | "PATCH";
  path: string;
  description: string;
  body?: string;
};

function InstructionSelectionGroup<T extends { id: string; text: string }>({
  label,
  items,
  selectedIds,
  onToggle,
  onToggleAll,
  renderMeta,
  className,
}: {
  label: string;
  items: T[];
  selectedIds: Set<string>;
  onToggle: (id: string, selected: boolean) => void;
  onToggleAll: (selected: boolean) => void;
  renderMeta?: (item: T) => string;
  className?: string;
}) {
  const allSelected =
    items.length > 0 && items.every((item) => selectedIds.has(item.id));
  return (
    <section className={className}>
      <div className="flex items-center justify-between rounded-md bg-surface-muted/45 px-3 py-2">
        <label className="flex cursor-pointer items-center gap-2 text-[11px] font-black text-text-primary">
          <input
            type="checkbox"
            checked={allSelected}
            disabled={!items.length}
            onChange={(event) => onToggleAll(event.target.checked)}
            className="size-4 accent-brand-primary disabled:opacity-40"
          />
          {label}{" "}
          <span className="font-medium text-text-muted">({items.length})</span>
        </label>
        <span className="text-[10px] text-text-muted">
          {items.length ? "전체 선택" : "남은 항목 없음"}
        </span>
      </div>
      {items.length > 0 && (
        <div className="border-t border-surface-border-soft">
          {items.map((item, index) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-2 border-b border-surface-border-soft px-3 py-2 last:border-b-0 hover:bg-surface-muted/40"
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[10px] font-black text-brand-primary">
                {index + 1}
              </span>
              <input
                type="checkbox"
                checked={selectedIds.has(item.id)}
                onChange={(event) => onToggle(item.id, event.target.checked)}
                className="size-4 shrink-0 accent-brand-primary"
              />
              <span className="min-w-0 flex-1 text-[11px] text-text-primary">
                {item.text}
              </span>
              {renderMeta && (
                <span className="shrink-0 rounded border border-surface-border-soft px-1.5 py-0.5 text-[10px] font-bold text-brand-primary">
                  {renderMeta(item)}
                </span>
              )}
            </label>
          ))}
        </div>
      )}
    </section>
  );
}

function TaskInstructionDialog({
  todo,
  onClose,
}: {
  todo: TodoItem;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const origin =
    typeof window === "undefined"
      ? "http://127.0.0.1:4300"
      : window.location.origin;
  const [additionalInstruction, setAdditionalInstruction] = useState("");
  const [targetFolders, setTargetFolders] = useState(
    () => savedAgentTargetFolder(todo).trim() || todo.relatedFiles.join("\n"),
  );
  const availablePlans = todo.checklist.filter((item) => !item.completed);
  const availableVerificationChecks = todo.verificationChecks.filter(
    (item) => !item.passed,
  );
  const [selectedPlanIds, setSelectedPlanIds] = useState(
    () => new Set(availablePlans.map((item) => item.id)),
  );
  const [selectedVerificationIds, setSelectedVerificationIds] = useState(
    () => new Set(availableVerificationChecks.map((item) => item.id)),
  );
  const plans = availablePlans.filter((item) => selectedPlanIds.has(item.id));
  const verificationChecks = availableVerificationChecks.filter((item) =>
    selectedVerificationIds.has(item.id),
  );
  const toggleSelection = (
    id: string,
    selected: boolean,
    setSelection: Dispatch<SetStateAction<Set<string>>>,
  ) => {
    setSelection((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const toggleAll = (
    items: { id: string }[],
    selected: boolean,
    setSelection: Dispatch<SetStateAction<Set<string>>>,
  ) => {
    setSelection(selected ? new Set(items.map((item) => item.id)) : new Set());
  };
  const instruction = useMemo(() => {
    const planLines = plans.length
      ? plans.map(
          (item) =>
            `- [${item.completed ? "x" : " "}]${item.layer && item.layer !== "기타" ? ` (${item.layer})` : ""} ${item.text}`,
        )
      : ["- 선택한 세부 계획 없음"];
    const verificationLines = verificationChecks.length
      ? verificationChecks.map(
          (item) =>
            `- [${item.passed ? "x" : " "}] ${item.text}${item.evidence ? ` — 근거: ${item.evidence}` : ""}`,
        )
      : ["- 선택한 조건 검증 없음"];
    return [
      "다음 작업을 진행해 주세요.",
      "",
      "## 작업 대상 폴더",
      targetFolders || "- 작업 대상 폴더를 먼저 확인해 주세요.",
      "",
      "## 작업 개요",
      `- 작업: ${todo.title}`,
      todo.description ? `- 설명: ${todo.description}` : "",
      todo.blockerReason ? `- 확인 필요: ${todo.blockerReason}` : "",
      "",
      "## 구현할 세부 계획",
      ...planLines,
      "",
      "## 조건 검증 (완료 기준)",
      "아래 조건은 세부 계획과 별도로 구현·테스트하여 충족 여부와 근거를 기록하세요.",
      ...verificationLines,
      ...(additionalInstruction.trim()
        ? ["", "## 추가 지시", additionalInstruction.trim()]
        : []),
      "",
      "## 작업 방식",
      "각 단계 완료 후 최신 version을 다시 조회해 세부 계획과 조건 검증 결과·근거를 갱신해 주세요.",
    ].join("\n");
  }, [
    additionalInstruction,
    plans,
    targetFolders,
    todo.blockerReason,
    todo.description,
    todo.title,
    verificationChecks,
  ]);
  const apiEndpoints = [
    {
      method: "GET",
      path: `/api/llm/todos/${todo.id}`,
      description: "작업 최신 상태 조회",
    },
    {
      method: "PATCH",
      path: `/api/llm/todos/${todo.id}`,
      description: "작업 상태·설명 수정",
    },
    {
      method: "GET",
      path: `/api/llm/todos/${todo.id}/plan`,
      description: "세부 계획 조회",
    },
    {
      method: "PATCH",
      path: `/api/llm/todos/${todo.id}/plan`,
      description: "세부 계획 저장",
    },
    {
      method: "GET",
      path: `/api/llm/todos/${todo.id}/verification`,
      description: "조건 검증 조회",
    },
    {
      method: "PATCH",
      path: `/api/llm/todos/${todo.id}/verification`,
      description: "조건 검증 저장",
    },
  ] as const;
  const copy = async (value: string, message: string) => {
    try {
      await copyToClipboard(value);
      showToast(message);
    } catch {
      showToast("클립보드에 복사하지 못했습니다. 다시 시도해 주세요.", "error");
    }
  };
  const addExistingLogicReviewInstruction = () => {
    const template =
      "구현 시작 전, 구현할 로직과 관련된 기존 코드·API 계약·DTO·예외 처리·테스트 패턴을 검토하세요.\n기존 구조와 일관되게 구현하세요. 필요한 기반이나 계약이 불명확하면 구현하지 말고 확인 결과와 제안을 먼저 보고하세요.\n서버·프론트가 모두 관련되면 서버 API 계약을 먼저 확정하고, 계약 확인 후 프론트를 연동하세요.";
    setAdditionalInstruction((current) =>
      current.includes(template)
        ? current
        : [current.trim(), template].filter(Boolean).join("\n\n"),
    );
    showToast("기존 로직 사전 검토 지시를 추가했습니다.");
  };
  const saveTargetFolders = () => {
    const value = targetFolders.trim();
    const key = agentTargetFolderStorageKey(todo);
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
    showToast(
      value
        ? "작업 영역 공통 작업 대상 폴더로 저장했습니다."
        : "저장한 작업 대상 폴더를 비웠습니다.",
    );
  };
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 p-3 sm:p-6 backdrop-blur-[1px]"
      onMouseDown={onClose}
    >
      <section
        style={{ width: "75vw", maxWidth: "1800px" }}
        className="flex h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-raised shadow-2xl sm:h-[calc(100vh-3rem)] sm:max-h-[860px]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-surface-border-soft px-4 py-3">
          <div>
            <p className="text-xs font-black text-brand-primary">지시 {"{}"}</p>
            <h3 className="text-sm font-black text-text-primary">
              Codex 작업 지시 만들기
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ui-icon-button size-7"
            aria-label="작업 지시 닫기"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-2 lg:grid-rows-1">
          <div className="min-h-0 space-y-4 overflow-y-auto p-4 lg:border-r lg:border-surface-border-soft">
            <div className="overflow-hidden rounded-lg border border-surface-border-soft">
              <div className="flex items-center justify-between bg-surface-muted/50 px-3 py-2">
                <div>
                  <p className="text-[11px] font-black text-text-primary">
                    지시 대상 선택
                  </p>
                  <p className="text-[10px] text-text-muted">
                    완료·통과 항목은 제외하고, 선택한 항목만 지시에 넣습니다.
                  </p>
                </div>
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-black text-brand-primary">
                  {plans.length + verificationChecks.length}개 선택
                </span>
              </div>
              <div>
                <InstructionSelectionGroup
                  label="세부 계획"
                  items={availablePlans}
                  selectedIds={selectedPlanIds}
                  onToggle={(id, selected) =>
                    toggleSelection(id, selected, setSelectedPlanIds)
                  }
                  onToggleAll={(selected) =>
                    toggleAll(availablePlans, selected, setSelectedPlanIds)
                  }
                  renderMeta={(item) =>
                    item.layer && item.layer !== "기타"
                      ? item.layer
                      : "작업 영역 없음"
                  }
                />
                <InstructionSelectionGroup
                  className="mt-2 border-t border-surface-border-soft pt-2"
                  label="조건 검증"
                  items={availableVerificationChecks}
                  selectedIds={selectedVerificationIds}
                  onToggle={(id, selected) =>
                    toggleSelection(id, selected, setSelectedVerificationIds)
                  }
                  onToggleAll={(selected) =>
                    toggleAll(
                      availableVerificationChecks,
                      selected,
                      setSelectedVerificationIds,
                    )
                  }
                />
              </div>
            </div>
            <label className="block">
              <span className="mb-1 flex items-center justify-between gap-2 text-[11px] font-black text-text-primary">
                작업 대상 폴더{" "}
                <button
                  type="button"
                  onClick={saveTargetFolders}
                  className="rounded border border-brand-border bg-brand-soft px-2 py-1 text-[10px] font-black text-brand-primary hover:bg-brand-soft/70"
                >
                  작업 영역 기본값 저장
                </button>
              </span>
              <textarea
                value={targetFolders}
                onChange={(event) => setTargetFolders(event.target.value)}
                placeholder="예: /Users/me/projects/api-server&#10;/Users/me/projects/web-client"
                rows={3}
                className="w-full resize-y rounded-lg border border-surface-border bg-surface-raised p-2.5 font-mono text-[11px] leading-5 text-text-primary outline-none focus:border-brand-border"
              />
              <span className="mt-1 block text-[10px] text-text-muted">
                같은 맨왼쪽 작업 영역의 모든 메뉴에서 공통으로 사용하며, 수정
                내용은 오른쪽 작업 지시에 즉시 반영됩니다.
              </span>
            </label>
            <label className="block">
              <span className="mb-1 flex items-center justify-between gap-2 text-[11px] font-black text-text-primary">
                추가 지시{" "}
                <button
                  type="button"
                  onClick={addExistingLogicReviewInstruction}
                  className="rounded border border-brand-border bg-brand-soft px-2 py-1 text-[10px] font-black text-brand-primary hover:bg-brand-soft/70"
                >
                  기존 로직 검토 추가
                </button>
              </span>
              <textarea
                value={additionalInstruction}
                onChange={(event) =>
                  setAdditionalInstruction(event.target.value)
                }
                placeholder="예: 기존 패턴을 따르고, 외부 API 계약 변경은 하지 마세요."
                rows={5}
                className="w-full resize-y rounded-lg border border-surface-border bg-surface-raised p-2.5 text-xs leading-5 text-text-primary outline-none focus:border-brand-border"
              />
            </label>
          </div>
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto bg-surface-muted/20 p-4">
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-1 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black text-text-primary">
                    Codex에 보낼 작업 지시
                  </p>
                  <p className="text-[10px] text-text-muted">
                    선택과 추가 지시에 따라 즉시 갱신됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void copy(instruction, "Codex 작업 지시를 복사했습니다.")
                  }
                  className="rounded-md bg-brand-primary px-3 py-1.5 text-[11px] font-black text-white"
                >
                  <ClipboardCopy className="mr-1 inline size-3.5" />
                  전체 복사
                </button>
              </div>
              <textarea
                value={instruction}
                readOnly
                className="min-h-[390px] flex-1 resize-y rounded-lg border border-surface-border bg-surface-raised p-3 font-mono text-[11px] leading-5 text-text-secondary outline-none"
              />
            </div>
            <details className="shrink-0 rounded-lg border border-surface-border-soft">
              <summary className="cursor-pointer px-3 py-2 text-[11px] font-black text-text-secondary">
                TODO API 참고 ({apiEndpoints.length})
              </summary>
              <div className="border-t border-surface-border-soft">
                <table className="w-full table-fixed text-left text-[11px]">
                  <tbody>
                    {apiEndpoints.map((endpoint) => (
                      <tr
                        key={`${endpoint.method}:${endpoint.path}`}
                        className="border-t border-surface-border-soft first:border-t-0"
                      >
                        <td className="w-16 px-3 py-2 font-black text-brand-primary">
                          {endpoint.method}
                        </td>
                        <td className="break-all px-2 py-2 font-mono text-text-primary">
                          {endpoint.path}
                        </td>
                        <td className="w-36 px-2 py-2 text-text-muted">
                          {endpoint.description}
                        </td>
                        <td className="w-12 px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              void copy(
                                `${endpoint.method} ${origin}${endpoint.path}`,
                                `${endpoint.method} 요청을 복사했습니다.`,
                              )
                            }
                            className="ui-icon-button size-7 text-brand-primary"
                            title="요청 복사"
                          >
                            <ClipboardCopy className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function TaskReviewDialog({
  todo,
  onClose,
}: {
  todo: TodoItem;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [reviewRequirements, setReviewRequirements] = useState("");
  const completedPlans = todo.checklist.filter((item) => item.completed);
  const passedVerificationChecks = todo.verificationChecks.filter(
    (item) => item.passed,
  );
  const [selectedPlanIds, setSelectedPlanIds] = useState(
    () => new Set(completedPlans.map((item) => item.id)),
  );
  const [selectedVerificationIds, setSelectedVerificationIds] = useState(
    () => new Set(passedVerificationChecks.map((item) => item.id)),
  );
  const targetFolders =
    savedAgentTargetFolder(todo).trim() || todo.relatedFiles.join("\n");
  const plans = completedPlans.filter((item) => selectedPlanIds.has(item.id));
  const verificationChecks = passedVerificationChecks.filter((item) =>
    selectedVerificationIds.has(item.id),
  );
  const toggleSelection = (
    id: string,
    selected: boolean,
    setSelection: Dispatch<SetStateAction<Set<string>>>,
  ) => {
    setSelection((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const toggleAll = (
    items: { id: string }[],
    selected: boolean,
    setSelection: Dispatch<SetStateAction<Set<string>>>,
  ) => {
    setSelection(selected ? new Set(items.map((item) => item.id)) : new Set());
  };
  const reviewRequest = useMemo(() => {
    const planLines = plans.length
      ? plans.map(
          (item) =>
            `- [x]${item.layer && item.layer !== "기타" ? ` (${item.layer})` : ""} ${item.text}`,
        )
      : ["- 선택한 완료 세부 계획 없음"];
    const verificationLines = verificationChecks.length
      ? verificationChecks.map(
          (item) =>
            `- [x] ${item.text}${item.evidence ? ` — 근거: ${item.evidence}` : ""}`,
        )
      : ["- 선택한 통과 조건 검증 없음"];
    return [
      "다음 구현 결과를 코드 리뷰해 주세요.",
      "",
      "## 작업 대상 폴더",
      targetFolders || "- 작업 대상 폴더를 먼저 확인해 주세요.",
      "",
      "## 작업 개요",
      `- 작업: ${todo.title}`,
      todo.description ? `- 설명: ${todo.description}` : "",
      "",
      "## 검토할 완료 세부 계획",
      ...planLines,
      "",
      "## 통과한 조건 검증",
      ...verificationLines,
      ...(reviewRequirements.trim()
        ? ["", "## 추가 리뷰 요구 사항", reviewRequirements.trim()]
        : []),
      "",
      "## 리뷰 방식",
      "구현을 변경하지 말고, 요구사항 누락·API 계약 불일치·예외/경계 조건·테스트 충분성·회귀 위험을 검토하세요.",
      "문제가 있으면 심각도, 관련 파일과 근거, 개선 제안을 정리하고, 문제가 없으면 검토 범위와 남은 위험을 보고하세요.",
    ].join("\n");
  }, [
    plans,
    reviewRequirements,
    targetFolders,
    todo.description,
    todo.title,
    verificationChecks,
  ]);
  const copy = async () => {
    try {
      await copyToClipboard(reviewRequest);
      showToast("Codex 리뷰 요청을 복사했습니다.");
    } catch {
      showToast("클립보드에 복사하지 못했습니다. 다시 시도해 주세요.", "error");
    }
  };
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 p-3 sm:p-6 backdrop-blur-[1px]"
      onMouseDown={onClose}
    >
      <section
        style={{ width: "75vw", maxWidth: "1800px" }}
        className="flex h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-raised shadow-2xl sm:h-[calc(100vh-3rem)] sm:max-h-[860px]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-surface-border-soft px-4 py-3">
          <div>
            <p className="text-xs font-black text-brand-primary">리뷰 {"{}"}</p>
            <h3 className="text-sm font-black text-text-primary">
              Codex 코드 리뷰 요청 만들기
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ui-icon-button size-7"
            aria-label="코드 리뷰 요청 닫기"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-2 lg:grid-rows-1">
          <div className="min-h-0 overflow-y-auto p-4 lg:border-r lg:border-surface-border-soft">
            <div className="overflow-hidden rounded-lg border border-surface-border-soft">
              <div className="flex items-center justify-between bg-surface-muted/50 px-3 py-2">
                <div>
                  <p className="text-[11px] font-black text-text-primary">
                    리뷰 대상 선택
                  </p>
                  <p className="text-[10px] text-text-muted">
                    완료·통과 항목만 기본으로 선택해, 현재 구현 결과를
                    검토합니다.
                  </p>
                </div>
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-black text-brand-primary">
                  {plans.length + verificationChecks.length}개 선택
                </span>
              </div>
              <div>
                <InstructionSelectionGroup
                  label="완료 세부 계획"
                  items={completedPlans}
                  selectedIds={selectedPlanIds}
                  onToggle={(id, selected) =>
                    toggleSelection(id, selected, setSelectedPlanIds)
                  }
                  onToggleAll={(selected) =>
                    toggleAll(completedPlans, selected, setSelectedPlanIds)
                  }
                  renderMeta={(item) =>
                    item.layer && item.layer !== "기타"
                      ? item.layer
                      : "작업 영역 없음"
                  }
                />
                <InstructionSelectionGroup
                  className="mt-2 border-t border-surface-border-soft pt-2"
                  label="통과 조건 검증"
                  items={passedVerificationChecks}
                  selectedIds={selectedVerificationIds}
                  onToggle={(id, selected) =>
                    toggleSelection(id, selected, setSelectedVerificationIds)
                  }
                  onToggleAll={(selected) =>
                    toggleAll(
                      passedVerificationChecks,
                      selected,
                      setSelectedVerificationIds,
                    )
                  }
                  renderMeta={(item) =>
                    item.evidence ? "근거 있음" : "근거 없음"
                  }
                />
              </div>
            </div>
          </div>
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto bg-surface-muted/20 p-4">
            <label className="block shrink-0">
              <span className="mb-1 block text-[11px] font-black text-text-primary">
                추가 리뷰 요구 사항
              </span>
              <textarea
                value={reviewRequirements}
                onChange={(event) => setReviewRequirements(event.target.value)}
                placeholder="예: 성능 영향과 기존 API 호환성도 중점적으로 검토해 주세요."
                rows={3}
                className="w-full resize-y rounded-lg border border-surface-border bg-surface-raised p-2.5 text-xs leading-5 text-text-primary outline-none focus:border-brand-border"
              />
            </label>
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-1 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black text-text-primary">
                    Codex에 보낼 리뷰 요청
                  </p>
                  <p className="text-[10px] text-text-muted">
                    선택한 완료 항목과 추가 요구 사항에 따라 즉시 갱신됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void copy()}
                  className="rounded-md bg-brand-primary px-3 py-1.5 text-[11px] font-black text-white"
                >
                  <ClipboardCopy className="mr-1 inline size-3.5" />
                  전체 복사
                </button>
              </div>
              <textarea
                value={reviewRequest}
                readOnly
                className="min-h-[350px] flex-1 resize-y rounded-lg border border-surface-border bg-surface-raised p-3 font-mono text-[11px] leading-5 text-text-secondary outline-none"
              />
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function AgentGuide({
  scope,
  todo,
  workstream,
  onClose,
}: {
  scope?: TodoScope;
  todo?: TodoItem;
  workstream?: TodoWorkstream;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const origin =
    typeof window === "undefined"
      ? "http://127.0.0.1:4300"
      : window.location.origin;
  const targetFolderKey = agentTargetFolderStorageKey(scope);
  const [savedTargetFolder, setSavedTargetFolder] = useState(() =>
    savedAgentTargetFolder(scope),
  );
  const [targetFolderDraft, setTargetFolderDraft] = useState(() =>
    savedAgentTargetFolder(scope),
  );
  const [additionalInstruction, setAdditionalInstruction] = useState("");
  const selectedWorkstream = workstream ?? todo?.workstream ?? "BACKEND";
  const selectedWorkstreamLabel = WORKSTREAM_META[selectedWorkstream].label;
  useEffect(() => {
    const value = savedAgentTargetFolder(scope);
    setSavedTargetFolder(value);
    setTargetFolderDraft(value);
  }, [scope, targetFolderKey]);
  const topicQuery = scope?.spaceCode
    ? `?spaceCode=${encodeURIComponent(scope.spaceCode)}`
    : "";
  const searchQuery = `${topicQuery ? `${topicQuery}&` : "?"}q=검색어&workstream=${selectedWorkstream}&status=TODO`;
  const listEndpoints: AgentEndpoint[] = [
    {
      id: "list",
      method: "GET",
      path: `/api/llm/todos${topicQuery}`,
      description: "현재 범위 TODO 전체 목록",
    },
    {
      id: "search",
      method: "GET",
      path: `/api/llm/todos${searchQuery}`,
      description: "제목·설명·완료 조건 검색 및 업무·상태 필터",
    },
    {
      id: "context",
      method: "GET",
      path: `/api/llm/todos/context${topicQuery}`,
      description: "Policy·구현 업무 영역 현황",
    },
    {
      id: "document-tree",
      method: "GET",
      path: scope?.topicId
        ? `/api/llm/hospital-playbook/topics/${scope.topicId}/documents`
        : "/api/llm/hospital-playbook/topics/{topicId}/documents",
      description: "상위 문서·하위 문서 전체 트리와 각 문서 조회 URL",
    },
    {
      id: "document",
      method: "GET",
      path: "/api/llm/hospital-playbook/documents/{documentId}",
      description: "문서 본문(Lexical JSON)과 version 조회",
    },
    {
      id: "document-context",
      method: "GET",
      path: "/api/llm/hospital-playbook/documents/{documentId}/context",
      description: "선택 문서 본문과 하위 문서 전체 맥락 조회",
    },
    {
      id: "create",
      method: "POST",
      path: "/api/llm/todos",
      description: "TODO 등록",
      body: JSON.stringify(
        {
          spaceCode: scope?.spaceCode ?? "PROTOTYPE",
          categoryId: scope?.categoryId ?? null,
          categoryTitle: scope?.categoryTitle ?? null,
          topicId: scope?.topicId ?? null,
          topicTitle: scope?.topicTitle ?? null,
          workstream: selectedWorkstream,
          title: "새 작업",
          description: "구현 범위",
          acceptanceCriteria: "완료 조건",
        },
        null,
        2,
      ),
    },
    {
      id: "update",
      method: "PATCH",
      path: "/api/llm/todos/{todoId}",
      description: "version 기준 TODO 수정",
      body: JSON.stringify(
        { status: "IN_PROGRESS", expectedVersion: 1 },
        null,
        2,
      ),
    },
    {
      id: "plan",
      method: "GET",
      path: "/api/llm/todos/{todoId}/plan",
      description: "상세 세부 계획과 각 단계 완료 여부 조회",
    },
    {
      id: "plan-update",
      method: "PATCH",
      path: "/api/llm/todos/{todoId}/plan",
      description: "상세 세부 계획과 완료 여부 저장",
      body: JSON.stringify(
        {
          expectedVersion: 1,
          steps: [
            {
              id: "step-1",
              text: "요청 DTO를 구현한다",
              completed: true,
              layer: "DTO",
            },
            {
              id: "step-2",
              text: "서비스 규칙을 구현하고 테스트한다",
              completed: false,
              layer: "Service",
            },
          ],
        },
        null,
        2,
      ),
    },
    {
      id: "verification",
      method: "GET",
      path: "/api/llm/todos/{todoId}/verification",
      description: "조건 검증 목록·통과 여부·검증 근거 조회",
    },
    {
      id: "verification-update",
      method: "PATCH",
      path: "/api/llm/todos/{todoId}/verification",
      description: "조건 검증 목록·통과 여부·검증 근거 저장",
      body: JSON.stringify(
        {
          expectedVersion: 1,
          checks: [
            {
              id: "verification-1",
              text: "유효 요청은 생성된다",
              passed: true,
              evidence: "통합 테스트 통과",
            },
          ],
        },
        null,
        2,
      ),
    },
    {
      id: "reorder",
      method: "POST",
      path: "/api/llm/todos/reorder",
      description: "같은 업무 영역의 전체 TODO 순서 저장",
      body: JSON.stringify(
        {
          ids: [21, 3, 4],
          categoryId: null,
          topicId: null,
          spaceCode: scope?.spaceCode ?? null,
          workstream: selectedWorkstream,
        },
        null,
        2,
      ),
    },
  ];
  const endpoints: AgentEndpoint[] = todo
    ? [
        {
          id: "todo-read",
          method: "GET",
          path: `/api/llm/todos/${todo.id}`,
          description: "현재 작업의 상태·설명·완료 조건·version 조회",
        },
        {
          id: "todo-update",
          method: "PATCH",
          path: `/api/llm/todos/${todo.id}`,
          description: "현재 작업의 상태·설명·완료 조건 수정",
          body: JSON.stringify(
            { status: "IN_PROGRESS", expectedVersion: todo.version },
            null,
            2,
          ),
        },
        {
          id: "plan-read",
          method: "GET",
          path: `/api/llm/todos/${todo.id}/plan`,
          description: "이 작업의 세부 계획과 완료 여부 조회",
        },
        {
          id: "plan-update",
          method: "PATCH",
          path: `/api/llm/todos/${todo.id}/plan`,
          description: "이 작업의 세부 계획 순서와 완료 여부 저장",
          body: JSON.stringify(
            { expectedVersion: todo.version, steps: todo.checklist },
            null,
            2,
          ),
        },
        {
          id: "verification-read",
          method: "GET",
          path: `/api/llm/todos/${todo.id}/verification`,
          description: "이 작업의 조건 검증 목록·통과 여부·검증 근거 조회",
        },
        {
          id: "verification-update",
          method: "PATCH",
          path: `/api/llm/todos/${todo.id}/verification`,
          description: "이 작업의 조건 검증 목록·통과 여부·검증 근거 저장",
          body: JSON.stringify(
            { expectedVersion: todo.version, checks: todo.verificationChecks },
            null,
            2,
          ),
        },
      ]
    : listEndpoints;
  const [selectedEndpointIds, setSelectedEndpointIds] = useState<string[]>([]);
  const selectedEndpoints = endpoints.filter((endpoint) =>
    selectedEndpointIds.includes(endpoint.id),
  );
  const allSelected =
    endpoints.length > 0 && selectedEndpointIds.length === endpoints.length;
  const toggleEndpoint = (id: string) => {
    setSelectedEndpointIds((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  };
  const toggleAll = () =>
    setSelectedEndpointIds(
      allSelected ? [] : endpoints.map((endpoint) => endpoint.id),
    );
  const copyText = async (value: string, message: string) => {
    try {
      await copyToClipboard(value);
      showToast(message);
    } catch {
      showToast("클립보드에 복사하지 못했습니다. 다시 시도해 주세요.", "error");
    }
  };
  const copyRequest = (endpoint: AgentEndpoint) => {
    return copyText(
      requestText(endpoint),
      `${endpoint.method} 요청 형식을 복사했습니다.`,
    );
  };
  const endpointRequestText = (endpoint: AgentEndpoint) => {
    const body = endpoint.body
      ? `\nContent-Type: application/json\n\n${endpoint.body}`
      : "";
    return `${endpoint.method} ${origin}${endpoint.path}${body}`;
  };
  const requestText = (endpoint: AgentEndpoint) => {
    const targetFolder = targetFolderDraft.trim();
    const target = targetFolder ? `작업 대상 폴더:\n${targetFolder}\n\n` : "";
    return `${target}${endpointRequestText(endpoint)}`;
  };
  const agentInstruction = [
    "다음 TODO 작업을 진행해 주세요.",
    "",
    "## 작업 대상 폴더",
    targetFolderDraft.trim() || "- 작업 대상 폴더를 먼저 확인해 주세요.",
    "",
    "## 작업 범위",
    todo ? `- 작업: ${todo.title}` : `- 범위: ${scopeTitle(scope)}`,
    ...(todo?.description ? [`- 설명: ${todo.description}`] : []),
    "",
    "## 선택한 작업 탭과 위치",
    `- 업무 탭: ${selectedWorkstreamLabel} (${selectedWorkstream})`,
    `- spaceCode: ${scope?.spaceCode ?? todo?.spaceCode ?? "확인 필요"}`,
    `- 1차 메뉴: ${scope?.categoryTitle ?? todo?.categoryTitle ?? "확인 필요"} (ID: ${scope?.categoryId ?? todo?.categoryId ?? "확인 필요"})`,
    `- 2차 주제: ${scope?.topicTitle ?? todo?.topicTitle ?? "확인 필요"} (ID: ${scope?.topicId ?? todo?.topicId ?? "확인 필요"})`,
    "- 새 TODO는 위 업무 탭과 주제에 등록하고, 다른 탭·주제로 추정해 등록하지 마세요.",
    "",
    "## 선택한 API",
    ...(selectedEndpoints.length
      ? selectedEndpoints.flatMap((endpoint) => [
          `### ${endpoint.description}`,
          endpointRequestText(endpoint),
          "",
        ])
      : ["- 선택한 API 없음"]),
    ...(additionalInstruction.trim()
      ? ["", "## 추가 작업 지시", additionalInstruction.trim()]
      : []),
    "",
    "## 작업 방식",
    "작업 시작 전 최신 상태를 조회하고, 변경 요청에는 최신 version을 사용하세요. 필요한 구현·검증 결과는 해당 TODO의 세부 계획과 조건 검증에 반영하세요.",
  ].join("\n");
  const saveTargetFolder = () => {
    const value = targetFolderDraft.trim();
    if (value) window.localStorage.setItem(targetFolderKey, value);
    else window.localStorage.removeItem(targetFolderKey);
    setSavedTargetFolder(value);
    setTargetFolderDraft(value);
    showToast(
      value
        ? "작업 영역 공통 작업 대상 폴더로 저장했습니다."
        : "작업 대상 폴더를 비웠습니다.",
    );
  };
  const cancelTargetFolderEdit = () => setTargetFolderDraft(savedTargetFolder);
  return (
    <div
      className="absolute inset-0 z-30 flex items-start justify-center bg-black/30 p-3 backdrop-blur-[1px] sm:p-5"
      onMouseDown={onClose}
    >
      <section
        className="mt-2 flex h-[calc(100vh-1.5rem)] w-full max-w-[1800px] flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-raised shadow-2xl sm:mt-4 sm:h-[calc(100vh-2.5rem)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-surface-border-soft px-4 py-3">
          <div>
            <p className="text-xs font-black text-brand-primary">
              {todo ? "세부 계획 요청 {}" : "Agent 작업 요청 {}"}
            </p>
            <h3 className="text-sm font-black text-text-primary">
              {todo ? `${todo.title} · 상세 TODO API` : "NOVA 작업 TODO API"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ui-icon-button size-7"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
          <section className="min-h-0 space-y-3 overflow-y-auto p-4 text-xs lg:border-r lg:border-surface-border-soft">
            <div className="flex items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-[11px] font-bold text-text-secondary">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="size-4 accent-brand-primary"
                />
                전체 선택
              </label>
              <button
                type="button"
                onClick={() =>
                  void copyText(
                    selectedEndpoints.map(requestText).join("\n\n"),
                    `${selectedEndpoints.length}개 요청 형식을 복사했습니다.`,
                  )
                }
                disabled={selectedEndpoints.length === 0}
                className="rounded-md bg-brand-primary px-3 py-2 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ClipboardCopy className="mr-1 inline size-3.5" />
                선택 요청 복사 ({selectedEndpoints.length})
              </button>
            </div>
            <div className="overflow-hidden rounded-lg border border-surface-border-soft">
              <table className="w-full table-fixed border-collapse text-left">
                <colgroup>
                  <col style={{ width: "48px" }} />
                  <col style={{ width: "72px" }} />
                  <col style={{ width: "38%" }} />
                  <col />
                  <col style={{ width: "56px" }} />
                </colgroup>
                <thead className="bg-surface-muted text-[10px] font-black text-text-secondary">
                  <tr>
                    <th className="px-2 py-2 text-center">선택</th>
                    <th className="px-2 py-2">방식</th>
                    <th className="px-3 py-2">API</th>
                    <th className="px-2 py-2">하는 일</th>
                    <th className="px-2 py-2 text-center">복사</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoints.map((endpoint) => {
                    return (
                      <tr
                        key={endpoint.id}
                        className="border-t border-surface-border-soft align-middle hover:bg-surface-muted/60"
                      >
                        <td className="px-2 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={selectedEndpointIds.includes(endpoint.id)}
                            onChange={() => toggleEndpoint(endpoint.id)}
                            aria-label={`${endpoint.description} 선택`}
                            className="size-4 accent-brand-primary"
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <HttpMethodBadge method={endpoint.method as HttpMethod} />
                        </td>
                        <td className="break-all px-3 py-2.5 font-mono text-[11px] leading-4 text-text-primary">
                          {endpoint.path}
                        </td>
                        <td className="px-2 py-2.5 text-[11px] leading-4 text-text-muted">
                          {endpoint.description}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <button
                            type="button"
                            title="요청 형식 복사"
                            onClick={() => void copyRequest(endpoint)}
                            className="ui-icon-button size-7 text-brand-primary"
                          >
                            <ClipboardCopy className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="rounded-lg border border-surface-border-soft bg-surface-muted/50 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <label
                  htmlFor="agent-target-folder"
                  className="text-[11px] font-black text-text-primary"
                >
                  작업 대상 폴더{" "}
                  <span className="font-medium text-text-muted">
                    (작업 영역 공통)
                  </span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={cancelTargetFolderEdit}
                    disabled={targetFolderDraft === savedTargetFolder}
                    className="rounded-md px-2 py-1 text-[10px] font-bold text-text-muted hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={saveTargetFolder}
                    disabled={targetFolderDraft === savedTargetFolder}
                    className="rounded-md bg-brand-primary px-2.5 py-1 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    저장
                  </button>
                </div>
              </div>
              <textarea
                id="agent-target-folder"
                value={targetFolderDraft}
                onChange={(event) => setTargetFolderDraft(event.target.value)}
                rows={2}
                placeholder="예: /Users/me/projects/nova-bss"
                className="w-full resize-y rounded-md border border-surface-border bg-surface-raised px-2.5 py-2 font-mono text-[11px] leading-4 text-text-primary outline-none focus:border-brand-border"
              />
            </div>
            <label className="block rounded-lg border border-surface-border-soft bg-surface-muted/50 p-3">
              <span className="mb-2 block text-[11px] font-black text-text-primary">
                추가 작업 지시
              </span>
              <textarea
                value={additionalInstruction}
                onChange={(event) =>
                  setAdditionalInstruction(event.target.value)
                }
                rows={3}
                placeholder="예: 기존 구현 패턴을 확인하고, 변경 전후 테스트를 실행해 주세요."
                className="w-full resize-y rounded-md border border-surface-border bg-surface-raised px-2.5 py-2 text-[11px] leading-4 text-text-primary outline-none focus:border-brand-border"
              />
              <span className="mt-1.5 block text-[10px] text-text-muted">
                입력 내용은 오른쪽 Codex 작업 지시에 즉시 반영됩니다.
              </span>
            </label>
          </section>
          <section className="flex min-h-0 flex-col bg-surface-muted/20 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black text-text-primary">
                  Codex에 보낼 작업 지시
                </p>
                <p className="text-[10px] text-text-muted">
                  API 선택과 작업 대상 폴더 수정이 즉시 반영됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  void copyText(
                    agentInstruction,
                    "Codex 작업 지시를 복사했습니다.",
                  )
                }
                className="rounded-md bg-brand-primary px-3 py-1.5 text-[11px] font-black text-white"
              >
                <ClipboardCopy className="mr-1 inline size-3.5" />
                전체 복사
              </button>
            </div>
            <textarea
              value={agentInstruction}
              readOnly
              aria-label="생성된 Codex 작업 지시"
              className="min-h-[420px] flex-1 resize-y rounded-lg border border-surface-border bg-surface-raised p-3 font-mono text-[11px] leading-5 text-text-secondary outline-none"
            />
          </section>
        </div>
      </section>
    </div>
  );
}

function ApiSpecDialog({
  scope,
  onClose,
}: {
  scope?: TodoScope;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-start justify-center bg-black/30 p-5 backdrop-blur-[1px]"
      onMouseDown={onClose}
    >
      <section
        className="mt-8 w-full max-w-2xl rounded-xl border border-surface-border bg-surface-raised shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-surface-border-soft px-4 py-3">
          <div>
            <p className="text-xs font-black text-brand-primary">API Spec</p>
            <h3 className="text-sm font-black text-text-primary">
              현재 주제 API 계약 관리
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ui-icon-button size-7"
            aria-label="API Spec 닫기"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="space-y-3 p-4">
          <p className="rounded-lg bg-brand-glass p-3 text-xs leading-5 text-text-secondary">
            <strong className="text-text-primary">{scopeTitle(scope)}</strong>의
            엔드포인트·요청·응답·구현 상태를 이곳에서 관리합니다. 작업 보드와
            API 계약을 분리합니다.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["API 목록", "메서드·경로·도메인별 엔드포인트"],
              ["계약", "요청·응답·오류 코드와 버전"],
              ["검증", "구현 상태와 테스트 결과"],
            ].map(([title, description]) => (
              <div
                key={title}
                className="rounded-lg border border-surface-border-soft bg-surface-muted/50 p-3"
              >
                <p className="text-xs font-black text-text-primary">{title}</p>
                <p className="mt-1 text-[11px] leading-4 text-text-muted">
                  {description}
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-dashed border-brand-border bg-brand-glass/30 px-3 py-3">
            <div>
              <p className="text-xs font-black text-text-primary">
                API 테스트 콘솔
              </p>
              <p className="mt-0.5 text-[11px] text-text-muted">
                환경 변수, 요청 편집, 응답 기록과 히스토리를 포함하는 다음
                단계입니다.
              </p>
            </div>
            <span className="shrink-0 rounded-md border border-brand-border bg-surface-raised px-2 py-1 text-[10px] font-black text-brand-primary">
              구현 예정
            </span>
          </div>
          <p className="text-[11px] text-text-muted">
            처음에는 이 다이얼로그 안에서 Spec과 테스트를 제공하고,
            저장·히스토리·다중 환경이 커질 때만 별도 Tauri 창으로 분리합니다.
          </p>
        </div>
      </section>
    </div>
  );
}

export function TodoDrawer({
  open,
  onOpenChange,
  scope,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope?: TodoScope;
}) {
  const {
    todos,
    isLoading,
    error,
    reload,
    addTodo,
    updateTodo,
    toggleComplete,
    toggleImportant,
    deleteTodo,
    reorderTodos,
    totalCount,
    completedCount,
    activeCount,
    progressPercent,
  } = useTodos(scope);
  const { showToast } = useToast();
  const [drawerSize, setDrawerSize] = useState(storedTodoDrawerSize);
  const [workstream, setWorkstream] = useState<TodoWorkstream>("BACKEND");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [inputText, setInputText] = useState("");
  const [important, setImportant] = useState(false);
  const [selectedTodoId, setSelectedTodoId] = useState<number | null>(null);
  const [isDetailClosing, setIsDetailClosing] = useState(false);
  const [selectedTodoIds, setSelectedTodoIds] = useState<number[]>([]);
  const [agentGuideOpen, setAgentGuideOpen] = useState(false);
  const [apiSpecOpen, setApiSpecOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [exportDirectory, setExportDirectory] = useState<string | null>(null);
  const [exportFolderMenuOpen, setExportFolderMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const selectedTodo = todos.find((todo) => todo.id === selectedTodoId) ?? null;

  const closeDetail = useCallback(() => {
    if (selectedTodoId === null || isDetailClosing) return;
    setIsDetailClosing(true);
    window.setTimeout(() => {
      setSelectedTodoId(null);
      setIsDetailClosing(false);
    }, 200);
  }, [isDetailClosing, selectedTodoId]);
  const streamTodos = useMemo(
    () =>
      todos.filter(
        (todo) =>
          todo.workstream === workstream ||
          (workstream === "BACKEND" && todo.workstream === "API"),
      ),
    [todos, workstream],
  );
  const visibleTodos = useMemo(
    () =>
      streamTodos.filter((todo) => {
        if (statusFilter !== "ALL" && todo.status !== statusFilter)
          return false;
        return (
          !search.trim() ||
          todo.title.toLowerCase().includes(search.toLowerCase()) ||
          todo.description.toLowerCase().includes(search.toLowerCase())
        );
      }),
    [search, statusFilter, streamTodos],
  );
  const visibleTodoIds = useMemo(
    () => visibleTodos.map((todo) => todo.id),
    [visibleTodos],
  );
  const allVisibleSelected =
    visibleTodoIds.length > 0 &&
    visibleTodoIds.every((id) => selectedTodoIds.includes(id));
  const reorderDisabled = statusFilter !== "ALL" || Boolean(search.trim());

  const refreshTodos = async () => {
    if (isRefreshing) return;
    const startedAt = performance.now();
    setIsRefreshing(true);
    try {
      await reload();
    } finally {
      // 빠른 로컬 조회에도 헤더 새로고침과 같은 한 번의 회전 피드백을 보인다.
      const remaining = 650 - (performance.now() - startedAt);
      if (remaining > 0)
        await new Promise((resolve) => window.setTimeout(resolve, remaining));
      setIsRefreshing(false);
    }
  };

  const exportVisibleTodos = async () => {
    if (visibleTodos.length === 0) {
      showToast("내보낼 작업이 없습니다.", "error");
      return;
    }

    const ExcelJS = (await import("exceljs")).default;
    const exportedAt = new Date().toLocaleString("ko-KR");
    const taskRows = visibleTodos.map((todo) => [
      todo.id,
      WORKSTREAM_META[todo.workstream].label,
      STATUS_META[todo.status].label,
      todo.important ? "Y" : "N",
      todo.title,
      todo.description,
      todo.blockerReason,
      `${todo.checklist.filter((item) => item.completed).length}/${todo.checklist.length}`,
      `${todo.verificationChecks.filter((item) => item.passed).length}/${todo.verificationChecks.length}`,
      todo.relatedFiles.join("\n"),
      todo.relatedApiRequestIds.join(", "),
      todo.version,
      new Date(todo.updatedAt).toLocaleString("ko-KR"),
    ]);
    const planRows = visibleTodos.flatMap((todo) =>
      todo.checklist.map((item, index) => [
        todo.id,
        todo.title,
        index + 1,
        item.completed ? "완료" : "미완료",
        item.layer,
        item.text,
      ]),
    );
    const verificationRows = visibleTodos.flatMap((todo) =>
      todo.verificationChecks.map((item, index) => [
        todo.id,
        todo.title,
        index + 1,
        item.passed ? "충족" : "미충족",
        item.text,
        item.evidence,
      ]),
    );
    const createSheet = (
      workbook: InstanceType<typeof ExcelJS.Workbook>,
      title: string,
      headers: string[],
      rows: Array<Array<string | number>>,
    ) => {
      const sheet = workbook.addWorksheet(title, {
        views: [{ state: "frozen", ySplit: 4 }],
      });
      sheet.addRow([title]);
      sheet.addRow(["내보낸 시각", exportedAt]);
      sheet.addRow([]);
      const headerRow = sheet.addRow(headers);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1F4E78" },
      };
      rows.forEach((row) => sheet.addRow(row));
      sheet.columns.forEach((column, index) => {
        column.width = Math.min(
          Math.max(
            headers[index].length + 2,
            ...rows.map(
              (row) =>
                String(row[index] ?? "")
                  .split("\n")
                  .reduce((width, line) => Math.max(width, line.length), 0) + 2,
            ),
          ),
          42,
        );
      });
      return sheet;
    };

    const workbook = new ExcelJS.Workbook();
    createSheet(
      workbook,
      "작업 목록",
      [
        "ID",
        "작업 영역",
        "상태",
        "중요",
        "작업",
        "작업 설명",
        "막힘 / 결정 대기",
        "세부 계획",
        "조건 검증",
        "관련 파일",
        "연결 API",
        "버전",
        "수정 시각",
      ],
      taskRows,
    );
    createSheet(
      workbook,
      "세부 계획",
      ["작업 ID", "작업", "순서", "완료", "구현 영역", "내용"],
      planRows,
    );
    createSheet(
      workbook,
      "조건 검증",
      ["작업 ID", "작업", "순서", "충족", "조건", "근거"],
      verificationRows,
    );
    const safeTitle = scopeTitle(scope).replace(/[\\/:*?"<>|]/g, "_");
    const timestamp = new Date()
      .toISOString()
      .slice(0, 16)
      .replace(/[:T]/g, "-");
    const fileName = `${safeTitle}_작업_${timestamp}.xlsx`;
    const contents = new Uint8Array(await workbook.xlsx.writeBuffer());
    if (isTauri && exportDirectory) {
      try {
        const [{ join }, { writeFile }] = await Promise.all([
          import("@tauri-apps/api/path"),
          import("@tauri-apps/plugin-fs"),
        ]);
        const filePath = await join(exportDirectory, fileName);
        await writeFile(filePath, contents);
        showToast(
          `${visibleTodos.length}개 작업과 세부 정보를 지정한 폴더에 내보냈습니다.`,
          "success",
        );
        return;
      } catch (error) {
        showToast(
          `지정한 폴더에 저장하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
        return;
      }
    }
    const file = new Blob([contents], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const downloadUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    showToast(
      `${visibleTodos.length}개 작업과 세부 정보를 시스템 다운로드 폴더에 내보냈습니다.`,
      "success",
    );
  };

  const chooseExportDirectory = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "엑셀 저장 폴더 선택",
      });
      if (selected) {
        setExportDirectory(selected);
        showToast("엑셀 저장 폴더를 지정했습니다.", "success");
      }
    } catch (error) {
      showToast(
        `저장 폴더를 지정하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  };

  const openExportDirectory = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_directory", { directory: exportDirectory });
    } catch (error) {
      showToast(
        `저장 폴더를 열지 못했습니다: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  };

  useEffect(() => {
    if (!open) {
      setSelectedTodoId(null);
      setSelectedTodoIds([]);
    }
  }, [open]);
  useEffect(() => {
    if (open) void reload();
  }, [open, reload]);
  useEffect(() => {
    setSelectedTodoIds((ids) =>
      ids.filter((id) => visibleTodoIds.includes(id)),
    );
  }, [visibleTodoIds]);
  useEffect(() => {
    if (open) {
      setMounted(true);
      // Tauri WebView는 짧은 timeout 안의 상태 변경을 첫 paint로 합쳐 버릴 수 있다.
      // 두 프레임을 분리해 화면 밖(transform 100%) 상태를 확실히 그린 뒤 이동시킨다.
      let secondFrame = 0;
      const firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        window.cancelAnimationFrame(firstFrame);
        if (secondFrame) window.cancelAnimationFrame(secondFrame);
      };
    }
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), 420);
    return () => window.clearTimeout(timer);
  }, [open]);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  useEffect(() => {
    if (!open) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (apiSpecOpen) {
        setApiSpecOpen(false);
        return;
      }
      if (agentGuideOpen) {
        setAgentGuideOpen(false);
        return;
      }
      // 상세 작업이 열려 있으면 상세 컴포넌트가 Esc를 처리한다.
      if (selectedTodoId !== null) return;
      close();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [agentGuideOpen, apiSpecOpen, close, open, selectedTodoId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!inputText.trim()) return;
    await addTodo(inputText, workstream, important);
    setInputText("");
    setImportant(false);
  };

  const selectTodo = (id: number) =>
    setSelectedTodoId((current) => (current === id ? null : id));

  const toggleTodoSelection = (id: number) => {
    setSelectedTodoIds((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  };

  const toggleAllVisible = () => {
    setSelectedTodoIds((ids) =>
      allVisibleSelected
        ? ids.filter((id) => !visibleTodoIds.includes(id))
        : [...new Set([...ids, ...visibleTodoIds])],
    );
  };

  const updateSelected = async (patch: Partial<TodoItem>) => {
    const ids = [...selectedTodoIds];
    await Promise.all(ids.map((id) => updateTodo(id, patch)));
    setSelectedTodoIds([]);
  };

  const deleteSelected = async () => {
    const ids = [...selectedTodoIds];
    if (
      !ids.length ||
      !window.confirm(`선택한 ${ids.length}개 작업을 삭제할까요?`)
    )
      return;
    await Promise.all(ids.map((id) => deleteTodo(id)));
    setSelectedTodoIds([]);
  };

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[110] flex justify-end bg-black/20 backdrop-blur-[1px] ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
      style={{ transition: "opacity 360ms ease-out" }}
      onMouseDown={() => {
        // 세부 화면이 열린 동안 바깥을 누르면 한 단계만 닫는다.
        // 이전에는 이 클릭이 곧바로 작업 드로어까지 닫아 버렸다.
        if (selectedTodoId !== null) {
          closeDetail();
          return;
        }
        close();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="NOVA 작업 관리"
        onMouseDown={(event) => event.stopPropagation()}
        className="relative flex h-full flex-col border-l border-surface-border bg-surface-raised shadow-2xl will-change-transform"
        style={{
          width: `${drawerSize}vw`,
          maxWidth: "none",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition:
            "transform 400ms cubic-bezier(0.22, 1, 0.36, 1), width 240ms ease",
        }}
      >
        <div className="absolute left-0 top-28 z-20 flex -translate-x-full flex-col items-center rounded-l-xl border border-r-0 border-surface-border bg-surface-raised p-1 shadow-[-4px_0_14px_rgba(0,0,0,0.07)]">
          {TODO_DRAWER_SIZES.map((size) => (
            <button
              key={size.label}
              type="button"
              title={`너비 ${size.label} (${size.value}%)`}
              onClick={() => {
                setDrawerSize(size.value);
                window.localStorage.setItem(
                  TODO_DRAWER_SIZE_KEY,
                  String(size.value),
                );
              }}
              className={`grid size-7.5 place-items-center rounded-lg text-xs font-black ${drawerSize === size.value ? "bg-brand-primary text-white" : "text-text-muted hover:bg-surface-muted"}`}
            >
              {size.label}
            </button>
          ))}
        </div>

        <header className="flex shrink-0 items-center justify-between border-b border-surface-border-soft px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-brand-glass text-brand-primary">
              <ListTodo className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black text-text-primary">
                {scopeTitle(scope)} · 작업 관리
              </h2>
              <p className="text-[11px] text-text-muted">
                {activeCount}개 진행 · {completedCount}개 완료
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void refreshTodos()}
              disabled={isRefreshing}
              title="작업 새로고침"
              aria-label="작업 새로고침"
              className="ui-icon-button size-8 text-text-muted hover:text-brand-primary disabled:cursor-wait disabled:opacity-50"
            >
              <RefreshCw
                className={`size-3.5 ${isRefreshing ? "refresh-icon-spin" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={() => setApiSpecOpen(true)}
              title="현재 주제 API Spec"
              className="inline-flex h-8 items-center justify-center rounded-lg border border-surface-border bg-surface-muted px-3 text-xs font-black text-text-secondary transition-colors hover:border-brand-border hover:text-brand-primary"
            >
              API Spec
            </button>
            <button
              type="button"
              onClick={() => setAgentGuideOpen(true)}
              title="Agent 작업 요청 안내"
              className="inline-flex h-8 items-center justify-center rounded-lg border border-brand-border bg-brand-glass px-3 text-xs font-black text-brand-primary transition-colors hover:bg-brand-primary/10"
            >
              Agent 작업 요청 {"{}"}
            </button>
            <button
              type="button"
              onClick={close}
              aria-label="닫기"
              className="ui-icon-button size-8 text-text-muted"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="border-b border-surface-border-soft bg-surface-muted/40 px-4 py-2">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span>완료율</span>
            <span className="text-brand-primary">{progressPercent}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-border-soft">
            <div
              className="h-full rounded-full bg-brand-primary"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <form
          onSubmit={(event) => void submit(event)}
          className="border-b border-surface-border-soft p-3"
        >
          <div className="flex gap-1.5">
            <input
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              placeholder={`${WORKSTREAM_META[workstream].label} 작업 추가`}
              className="h-9 min-w-0 flex-1 rounded-md border border-surface-border bg-surface-muted px-2.5 text-xs font-semibold outline-none focus:border-brand-border"
            />
            <button
              type="button"
              onClick={() => setImportant((value) => !value)}
              className={`ui-icon-button size-9 ${important ? "text-amber-500" : "text-text-muted"}`}
            >
              <Star
                className="size-4"
                fill={important ? "currentColor" : "none"}
              />
            </button>
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="rounded-md bg-brand-primary px-3 text-xs font-black text-white disabled:opacity-40"
            >
              <Plus className="mr-0.5 inline size-3.5" />
              등록
            </button>
          </div>
        </form>

        <div className="border-b border-surface-border-soft px-3 py-2">
          <div className="flex items-center gap-1 overflow-x-auto">
            {TASK_WORKSTREAMS.map((item) => {
              const count = todos.filter(
                (todo) =>
                  (todo.workstream === item ||
                    (item === "BACKEND" && todo.workstream === "API")) &&
                  todo.status !== "DONE",
              ).length;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setWorkstream(item);
                    setSelectedTodoId(null);
                  }}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-black ${workstream === item ? "bg-brand-primary text-white" : "bg-surface-muted text-text-secondary hover:text-text-primary"}`}
                >
                  {WORKSTREAM_META[item].label}{" "}
                  <span className="opacity-80">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="flex shrink-0 items-center gap-1">
              {(["ALL", ...TODO_STATUSES] as StatusFilter[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setStatusFilter(item)}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${statusFilter === item ? "bg-brand-glass text-brand-primary" : "text-text-muted"}`}
                >
                  {item === "ALL" ? "전체" : STATUS_META[item].label}
                </button>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void exportVisibleTodos()}
                title="현재 목록과 상세 정보를 엑셀로 다운로드"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-surface-border bg-surface-raised px-2.5 text-[10px] font-black text-text-secondary hover:border-brand-border hover:text-brand-primary"
              >
                <Download className="size-3.5" />
                엑셀 다운로드
              </button>
              {isTauri && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setExportFolderMenuOpen((value) => !value)}
                    title="엑셀 저장 폴더 메뉴"
                    aria-label="엑셀 저장 폴더 메뉴"
                    aria-expanded={exportFolderMenuOpen}
                    className="ui-icon-button inline-flex h-8 min-w-10 items-center justify-center gap-1 px-2 text-text-muted hover:border-brand-border hover:text-brand-primary"
                  >
                    <FolderOpen className="size-4" />
                    <ChevronDown className="size-3" />
                  </button>
                  {exportFolderMenuOpen && (
                    <div className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-md border border-surface-border bg-surface-raised py-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setExportFolderMenuOpen(false);
                          void chooseExportDirectory();
                        }}
                        className="w-full px-3 py-2 text-left text-[11px] font-bold text-text-secondary hover:bg-surface-muted"
                      >
                        저장 폴더 지정…
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setExportFolderMenuOpen(false);
                          void openExportDirectory();
                        }}
                        className="w-full px-3 py-2 text-left text-[11px] font-bold text-text-secondary hover:bg-surface-muted"
                      >
                        {exportDirectory
                          ? "지정한 폴더 열기"
                          : "다운로드 폴더 열기"}
                      </button>
                      {exportDirectory && (
                        <button
                          type="button"
                          onClick={() => {
                            setExportDirectory(null);
                            setExportFolderMenuOpen(false);
                            showToast("기본 다운로드 폴더를 사용합니다.");
                          }}
                          className="w-full px-3 py-2 text-left text-[11px] font-bold text-text-secondary hover:bg-surface-muted"
                        >
                          기본 다운로드 폴더 사용
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              <label className="flex h-8 w-52 items-center gap-2 rounded-md border border-surface-border bg-surface-raised px-2.5 text-text-muted transition-colors focus-within:border-brand-border">
                <Search className="size-3.5 shrink-0" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="작업 검색"
                  className="min-w-0 flex-1 bg-transparent text-[11px] text-text-primary outline-none placeholder:text-text-muted"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3">
          {selectedTodoIds.length > 0 && (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-brand-border bg-brand-glass/40 px-3 py-2">
              <p className="text-[11px] font-black text-brand-primary">
                {selectedTodoIds.length}개 선택됨
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void updateSelected({ status: "IN_PROGRESS" })}
                  className="rounded-md border border-surface-border bg-surface-raised px-2 py-1 text-[10px] font-bold text-text-secondary hover:border-brand-border hover:text-brand-primary"
                >
                  진행
                </button>
                <button
                  type="button"
                  onClick={() => void updateSelected({ status: "DONE" })}
                  className="rounded-md border border-surface-border bg-surface-raised px-2 py-1 text-[10px] font-bold text-emerald-700 hover:border-emerald-300"
                >
                  완료
                </button>
                <button
                  type="button"
                  onClick={() => void updateSelected({ important: true })}
                  className="rounded-md border border-surface-border bg-surface-raised px-2 py-1 text-[10px] font-bold text-amber-600 hover:border-amber-300"
                >
                  중요
                </button>
                <button
                  type="button"
                  onClick={() => void deleteSelected()}
                  className="rounded-md border border-surface-border bg-surface-raised px-2 py-1 text-[10px] font-bold text-destructive hover:border-destructive/40"
                >
                  삭제
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTodoIds([])}
                  className="px-1.5 py-1 text-[10px] font-bold text-text-muted hover:text-text-primary"
                >
                  선택 해제
                </button>
              </div>
            </div>
          )}
          <div className="mx-auto w-full max-w-[1280px] overflow-hidden rounded-lg border border-surface-border-soft">
            <div
              className="grid gap-2 bg-surface-muted px-3 py-2 text-[10px] font-black text-text-muted"
              style={{
                gridTemplateColumns: "32px minmax(250px, 1fr) 84px 42px 96px",
              }}
            >
              <label className="grid place-items-center">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  aria-label="표시된 작업 전체 선택"
                  className="size-3.5 accent-brand-primary"
                />
              </label>
              <span>작업</span>
              <span>상태</span>
              <span className="text-center">중요</span>
              <span className="text-right">관리</span>
            </div>
            {isLoading ? (
              <div className="grid place-items-center p-8 text-text-muted">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : error ? (
              <p className="p-4 text-xs text-destructive">{error}</p>
            ) : visibleTodos.length === 0 ? (
              <div className="grid place-items-center gap-1 p-8 text-xs text-text-muted">
                <CheckCircle2 className="size-5 text-brand-primary" />
                표시할 작업이 없습니다.
              </div>
            ) : (
              <DragDropProvider
                onDragEnd={(event) => {
                  if (event.canceled || reorderDisabled) return;
                  const reordered = move(visibleTodos, event);
                  const ids = reordered.map((todo) => todo.id);
                  if (!ids.every((id, index) => id === visibleTodos[index]?.id))
                    void reorderTodos(ids, workstream);
                }}
              >
                {visibleTodos.map((todo, index) => (
                  <SortableTodoRow
                    key={todo.id}
                    todo={todo}
                    index={index}
                    disabled={reorderDisabled}
                  >
                    {({ ref, handleRef, isDragSource, isDropTarget }) => (
                      <div
                        ref={ref}
                        className={`border-t border-surface-border-soft first:border-t-0 transition-[background-color,box-shadow,opacity] duration-200 ${isDragSource ? "z-10 scale-[1.01] opacity-55 shadow-xl ring-2 ring-brand-border/50" : ""} ${isDropTarget && !isDragSource ? "bg-brand-glass ring-2 ring-brand-border/70" : ""}`}
                      >
                        <div
                          className={`grid cursor-pointer items-center gap-2 px-3 py-2.5 hover:bg-surface-muted/60 ${selectedTodoId === todo.id ? "bg-brand-glass/30" : ""}`}
                          style={{
                            gridTemplateColumns:
                              "32px minmax(250px, 1fr) 84px 42px 96px",
                          }}
                          onClick={() => selectTodo(todo.id)}
                        >
                          <label
                            className="grid place-items-center"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selectedTodoIds.includes(todo.id)}
                              onChange={() => toggleTodoSelection(todo.id)}
                              aria-label={`${todo.title} 선택`}
                              className="size-3.5 accent-brand-primary"
                            />
                          </label>
                          <div className="flex min-w-0 items-center gap-1.5">
                            <button
                              type="button"
                              ref={handleRef}
                              disabled={reorderDisabled}
                              onClick={(event) => event.stopPropagation()}
                              title={
                                reorderDisabled
                                  ? "필터와 검색을 해제하면 순서를 바꿀 수 있습니다."
                                  : "드래그하여 작업 순서 변경"
                              }
                              aria-label={`${todo.title} 드래그`}
                              className="grid size-5 shrink-0 cursor-grab touch-none place-items-center text-text-muted/70 hover:text-brand-primary active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <GripVertical className="size-3.5" />
                            </button>
                            <div className="min-w-0">
                              <p
                                className={`truncate text-xs font-bold ${todo.status === "DONE" ? "text-text-muted line-through" : "text-text-primary"}`}
                              >
                                {todo.title}
                              </p>
                              <p className="mt-0.5 truncate text-[10px] text-text-muted">
                                {
                                  todo.checklist.filter(
                                    (item) => item.completed,
                                  ).length
                                }
                                /{todo.checklist.length} 체크 ·{" "}
                                {todo.relatedApiRequestIds.length ? (
                                  <>
                                    <FileCode2 className="inline size-3" /> API{" "}
                                    {todo.relatedApiRequestIds.length}
                                  </>
                                ) : (
                                  "API 미연결"
                                )}{" "}
                                ·{" "}
                                {new Date(todo.updatedAt).toLocaleDateString(
                                  "ko-KR",
                                  { month: "numeric", day: "numeric" },
                                )}{" "}
                                수정
                              </p>
                            </div>
                          </div>
                          <CompactSelect
                            value={todo.status}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) =>
                              void updateTodo(todo.id, {
                                status: event.target.value as TodoStatus,
                              })
                            }
                            wrapperClassName="w-full"
                            className={`h-8 min-h-8 rounded-md py-0 pr-6 text-[10px] font-black ${STATUS_META[todo.status].className}`}
                            style={{ paddingLeft: "14px" }}
                          >
                            {TODO_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {STATUS_META[status].label}
                              </option>
                            ))}
                          </CompactSelect>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void toggleImportant(todo.id);
                            }}
                            className={`ui-icon-button mx-auto size-7 ${todo.important ? "text-amber-500" : "text-text-muted"}`}
                          >
                            <Star
                              className="size-3.5"
                              fill={todo.important ? "currentColor" : "none"}
                            />
                          </button>
                          <div className="flex justify-end gap-0.5">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                selectTodo(todo.id);
                              }}
                              className="ui-icon-button size-7 text-text-muted hover:text-brand-primary"
                              title="작업 수정"
                              aria-label={`${todo.title} 수정`}
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void toggleComplete(todo.id);
                              }}
                              className="ui-icon-button size-7 text-text-muted"
                              title={todo.status === "DONE" ? "미완료" : "완료"}
                            >
                              {todo.status === "DONE" ? (
                                <Check className="size-3.5 text-emerald-600" />
                              ) : (
                                <Circle className="size-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void deleteTodo(todo.id);
                              }}
                              className="ui-icon-button size-7 text-text-muted hover:text-destructive"
                              title="삭제"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </SortableTodoRow>
                ))}
              </DragDropProvider>
            )}
          </div>
        </div>
        {selectedTodo && (
          <TodoDetail
            todo={selectedTodo}
            isClosing={isDetailClosing}
            onClose={closeDetail}
            onSave={(patch) => updateTodo(selectedTodo.id, patch)}
            onRefresh={reload}
            onDelete={() => deleteTodo(selectedTodo.id)}
          />
        )}
        {agentGuideOpen && (
          <AgentGuide
            scope={scope}
            workstream={workstream}
            onClose={() => setAgentGuideOpen(false)}
          />
        )}
        {apiSpecOpen && (
          <ApiSpecDialog scope={scope} onClose={() => setApiSpecOpen(false)} />
        )}
      </aside>
    </div>,
    document.body,
  );
}
