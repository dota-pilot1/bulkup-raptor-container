"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Check,
  CheckCircle2,
  Circle,
  Filter,
  ListTodo,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import PageHeader from "@/shared/ui/PageHeader";
import { TODO_CATEGORIES, type TodoCategory } from "@/features/todo/types";
import { useTodos } from "@/features/todo/useTodos";

type StatusFilter = "all" | "active" | "completed" | "important";

export default function TodoModule() {
  const {
    todos,
    addTodo,
    updateTodo,
    toggleComplete,
    toggleImportant,
    deleteTodo,
    clearCompleted,
    totalCount,
    completedCount,
    activeCount,
    importantCount,
    progressPercent,
  } = useTodos();

  const [inputText, setInputText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<TodoCategory>("노트정리");
  const [isImportant, setIsImportant] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const handleAddTodo = (e: FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    addTodo(inputText, selectedCategory, isImportant);
    setInputText("");
    setIsImportant(false);
  };

  const startEdit = (todo: { id: number; title: string }) => {
    setEditingId(todo.id);
    setEditText(todo.title);
  };

  const saveEdit = (id: number) => {
    const text = editText.trim();
    if (text) {
      updateTodo(id, { title: text });
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleClear = () => {
    if (!window.confirm("완료된 할 일들을 모두 정리하시겠습니까?")) return;
    clearCompleted();
  };

  const filteredTodos = useMemo(() => {
    return todos.filter((item) => {
      if (statusFilter === "active" && item.completed) return false;
      if (statusFilter === "completed" && !item.completed) return false;
      if (statusFilter === "important" && !item.important) return false;

      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.title.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
      }

      return true;
    });
  }, [todos, statusFilter, categoryFilter, searchQuery]);

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-muted/30">
      <PageHeader>
        <ListTodo className="size-4 text-brand-primary" />
        <span className="text-[14px] font-bold tracking-tight text-text-primary">프로토타입 작업 (TODO)</span>
        <div className="ml-2 flex items-center gap-1.5 text-xs text-text-muted">
          <span className="rounded-full bg-brand-glass px-2 py-0.5 text-[11px] font-semibold text-brand-primary">
            {activeCount}개 진행 중
          </span>
          {completedCount > 0 && (
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-text-muted">
              {completedCount}개 완료
            </span>
          )}
        </div>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-6 py-6 space-y-6">
          {/* 상단 소개 및 진행률 카드 */}
          <section className="rounded-2xl border border-surface-border-soft bg-surface-raised p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-xl font-black tracking-tight text-text-primary flex items-center gap-2">
                  <span>노트 작성 전 할 일 정리</span>
                  <Sparkles className="size-4 text-brand-primary" />
                </h1>
                <p className="mt-1 text-xs font-medium text-text-secondary">
                  노트 작성과 실습을 시작하기 전, 해야 할 작업과 체크리스트를 미리 정리해 보세요.
                </p>
              </div>

              {/* 미니 프로그레스 바 */}
              <div className="w-full sm:w-56 shrink-0 rounded-xl bg-surface-muted/60 p-3 border border-surface-border-soft">
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <span className="text-text-secondary">학습 달성률</span>
                  <span className="text-brand-primary font-black tabular-nums">{progressPercent}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-border-soft">
                  <div
                    className="h-full bg-brand-primary transition-all duration-300 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] font-medium text-text-muted">
                  <span>진행 {activeCount}개</span>
                  <span>완료 {completedCount} / {totalCount}개</span>
                </div>
              </div>
            </div>

            {/* 할 일 입력 폼 */}
            <form onSubmit={handleAddTodo} className="mt-5 space-y-3">
              <div className="flex rounded-xl border border-surface-border bg-surface-muted/40 p-1.5 shadow-inner focus-within:border-brand-border focus-within:bg-surface-raised transition-all">
                <input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="새로운 할 일을 입력하세요... (예: 스프링 Security JWT 인증 필터 흐름 정리)"
                  aria-label="할 일 내용 입력"
                  className="min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-text-primary outline-none placeholder:text-text-muted"
                />
                <button
                  type="button"
                  onClick={() => setIsImportant(!isImportant)}
                  title={isImportant ? "중요 표시 해제" : "중요 표시 추가"}
                  className={`ui-icon-button h-9 w-9 shrink-0 mr-1 rounded-lg transition-colors ${
                    isImportant
                      ? "bg-amber-500/15 text-amber-500 hover:bg-amber-500/25"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  <Star className="size-4" fill={isImportant ? "currentColor" : "none"} />
                </button>
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="flex items-center gap-1 rounded-lg bg-brand-primary px-4 py-2 text-xs font-black text-white hover:bg-brand-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                >
                  <Plus className="size-4" />
                  <span>추가</span>
                </button>
              </div>

              {/* 카테고리 선택 칩 */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs">
                <span className="text-text-muted font-bold text-[11px] mr-1">분류 태그:</span>
                {TODO_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all border ${
                        isSelected
                          ? "bg-brand-primary text-white border-brand-primary shadow-xs"
                          : "bg-surface-raised text-text-secondary border-surface-border-soft hover:bg-surface-muted hover:text-text-primary"
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </form>
          </section>

          {/* 필터 및 검색 바 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border-soft pb-3">
            {/* 상태 탭 */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {(
                [
                  { id: "all", label: "전체", count: totalCount },
                  { id: "active", label: "진행 중", count: activeCount },
                  { id: "important", label: "중요", count: importantCount },
                  { id: "completed", label: "완료됨", count: completedCount },
                ] as const
              ).map((tab) => {
                const isSelected = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                      isSelected
                        ? "bg-brand-glass text-brand-primary"
                        : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                        isSelected ? "bg-brand-primary text-white" : "bg-surface-muted text-text-muted"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 검색 및 분류 필터 */}
            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                <Search className="absolute left-2.5 size-3.5 text-text-muted pointer-events-none" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="할 일 검색..."
                  className="h-8 w-40 rounded-lg border border-surface-border bg-surface-raised pl-8 pr-2.5 text-xs font-medium text-text-primary outline-none focus:border-brand-border placeholder:text-text-muted"
                />
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-surface-border bg-surface-raised px-2 py-1">
                <Filter className="size-3 text-text-muted" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-text-secondary outline-none cursor-pointer"
                >
                  <option value="all">모든 분류</option>
                  {TODO_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {completedCount > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  title="완료된 할 일 삭제"
                  className="ui-icon-button h-8 shrink-0 px-2 text-xs font-bold text-destructive hover:bg-destructive/10"
                >
                  완료 정리
                </button>
              )}
            </div>
          </div>

          {/* 할 일 리스트 영역 */}
          <div className="space-y-2 pb-12">
            {filteredTodos.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface-border bg-surface-raised/50 py-12 text-center">
                <div className="grid size-12 place-items-center rounded-full bg-brand-glass text-brand-primary">
                  {statusFilter === "completed" ? (
                    <CheckCircle2 className="size-6" />
                  ) : (
                    <ListTodo className="size-6" />
                  )}
                </div>
                <h3 className="mt-3 text-sm font-bold text-text-primary">
                  {searchQuery
                    ? "검색 결과와 일치하는 할 일이 없습니다."
                    : statusFilter === "completed"
                    ? "완료된 할 일이 아직 없습니다."
                    : statusFilter === "important"
                    ? "중요 표시된 할 일이 없습니다."
                    : "등록된 할 일이 없습니다."}
                </h3>
                <p className="mt-1 text-xs text-text-muted">
                  {searchQuery
                    ? "다른 키워드로 검색해 보세요."
                    : "상단 입력창에서 새로운 할 일을 등록해 보세요."}
                </p>
              </div>
            ) : (
              filteredTodos.map((todo) => {
                const categoryDef = TODO_CATEGORIES.find((c) => c.id === todo.category);
                return (
                  <article
                    key={todo.id}
                    className={`group flex items-center gap-3 rounded-xl border p-3.5 transition-all ${
                      todo.completed
                        ? "border-surface-border-soft bg-surface-raised/40 opacity-70"
                        : "border-surface-border-soft bg-surface-raised shadow-xs hover:border-brand-border/60 hover:shadow-sm"
                    }`}
                  >
                    {/* 커스텀 체크 버튼 */}
                    <button
                      type="button"
                      onClick={() => toggleComplete(todo.id)}
                      aria-label={todo.completed ? "미완료로 표시" : "완료로 표시"}
                      className={`grid size-6 shrink-0 place-items-center rounded-md border transition-all ${
                        todo.completed
                          ? "border-brand-primary bg-brand-primary text-white"
                          : "border-surface-border hover:border-brand-primary text-transparent"
                      }`}
                    >
                      {todo.completed ? <Check className="size-3.5 stroke-[3]" /> : <Circle className="size-3.5 text-text-muted/30" />}
                    </button>

                    {/* 내용 및 메타 정보 */}
                    <div className="min-w-0 flex-1">
                      {editingId === todo.id ? (
                        <div className="flex items-center gap-2 py-0.5">
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(todo.id);
                              if (e.key === "Escape") cancelEdit();
                            }}
                            autoFocus
                            className="w-full rounded-lg border border-brand-border bg-surface-raised px-2.5 py-1 text-sm font-semibold text-text-primary outline-none focus:ring-1 focus:ring-brand-primary"
                          />
                          <button
                            type="button"
                            onClick={() => saveEdit(todo.id)}
                            className="rounded-lg bg-brand-primary px-3 py-1 text-xs font-black text-white shrink-0"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-lg border border-surface-border bg-surface-muted px-2.5 py-1 text-xs font-bold text-text-muted shrink-0"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span
                              onDoubleClick={() => startEdit(todo)}
                              title="더블클릭하여 수정"
                              className={`truncate text-sm font-bold transition-all cursor-pointer ${
                                todo.completed
                                  ? "text-text-muted line-through"
                                  : "text-text-primary hover:text-brand-primary"
                              }`}
                            >
                              {todo.title}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-text-muted">
                            {categoryDef && (
                              <span
                                className={`rounded-md border px-1.5 py-0.2 text-[10px] font-extrabold ${categoryDef.badgeClass}`}
                              >
                                {categoryDef.label}
                              </span>
                            )}
                            <span>{new Date(todo.createdAt).toLocaleDateString("ko-KR")}</span>
                            {todo.completed && todo.completedAt && (
                              <span className="text-emerald-600 font-medium">
                                · {new Date(todo.completedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 완료
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* 수정 버튼 */}
                    {editingId !== todo.id && (
                      <button
                        type="button"
                        onClick={() => startEdit(todo)}
                        aria-label="할 일 수정"
                        title="할 일 수정"
                        className="ui-icon-button size-8 shrink-0 text-text-muted hover:text-brand-primary opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    )}

                    {/* 중요 토글 버튼 */}
                    <button
                      type="button"
                      onClick={() => toggleImportant(todo.id)}
                      aria-label={todo.important ? "중요 표시 해제" : "중요 표시"}
                      className={`ui-icon-button size-8 shrink-0 transition-colors ${
                        todo.important
                          ? "text-amber-500 hover:text-amber-600"
                          : "text-text-muted hover:text-text-primary"
                      }`}
                    >
                      <Star className="size-4" fill={todo.important ? "currentColor" : "none"} />
                    </button>

                    {/* 삭제 버튼 */}
                    <button
                      type="button"
                      onClick={() => deleteTodo(todo.id)}
                      aria-label="할 일 삭제"
                      className="ui-icon-button size-8 shrink-0 text-text-muted hover:text-destructive transition-colors opacity-80 group-hover:opacity-100"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
