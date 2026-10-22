/* eslint-disable react-hooks/set-state-in-effect -- 서버 TODO 조회 결과를 클라이언트 작업 상태에 반영한다. */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useShellUser } from "@/app/components/FullstackShell";
import { useToast } from "@/shared/ui/toast";
import {
  LEGACY_TODOS,
  type TodoCategory,
  type TodoItem,
  type TodoScope,
  type TodoStatus,
  type TodoWorkstream,
} from "./types";

type ApiTodo = Omit<TodoItem, "category" | "completed">;
type TodoPatch = Partial<Pick<TodoItem, "title" | "workstream" | "important" | "description" | "status" | "checklist" | "apiSpecs" | "acceptanceCriteria" | "verificationChecks" | "blockerReason" | "relatedFiles" | "verificationSummary">>;

function workstreamFromLegacy(category: TodoCategory): TodoWorkstream {
  if (category === "아이디어") return "API";
  if (category === "일반") return "DEVOPS";
  return "BACKEND";
}

function legacyCategory(workstream: TodoWorkstream): TodoCategory {
  return workstream === "API" ? "노트정리" : workstream === "DEVOPS" ? "일반" : "개발실습";
}

function normalizeTodo(value: ApiTodo): TodoItem {
  return { ...value, category: legacyCategory(value.workstream), completed: value.status === "DONE" };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message ?? "TODO 요청에 실패했습니다.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function useTodos(scope?: TodoScope) {
  const user = useShellUser();
  const { showToast } = useToast();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // TODO 목록은 맨왼쪽 작업 영역(space) 단위다. 노트의 1·2차 메뉴는
  // 작업을 작성할 때의 위치 정보로만 보관하고 조회 범위는 바꾸지 않는다.
  const spaceCode = scope?.spaceCode ?? null;
  const topicId = null;
  const categoryId = null;

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = spaceCode ? `?spaceCode=${encodeURIComponent(spaceCode)}` : "";
      const rows = await request<ApiTodo[]>(`/api/todos${query}`);
      setTodos(rows.map(normalizeTodo));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "TODO를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [spaceCode]);

  useEffect(() => { void load(); }, [load]);

  // 기존 브라우저 TODO는 첫 조회 때만 공통 범위 SQLite 데이터로 옮긴다.
  useEffect(() => {
    if (isLoading || todos.length > 0 || typeof window === "undefined") return;
    const storageKey = `pkt-study-todos-v1:${user?.email ?? "default"}`;
    const migrationKey = `${storageKey}:sqlite-migrated`;
    if (window.localStorage.getItem(migrationKey)) return;
    let legacy: Array<{ title?: string; category?: TodoCategory; important?: boolean; completed?: boolean }>;
    try {
      legacy = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") ?? [...LEGACY_TODOS];
    } catch {
      legacy = [...LEGACY_TODOS];
    }
    window.localStorage.setItem(migrationKey, "pending");
    void Promise.all(legacy.filter((item) => item.title).map(async (item) => {
      const created = await request<ApiTodo>("/api/todos", {
        method: "POST",
        body: JSON.stringify({ title: item.title, workstream: workstreamFromLegacy(item.category ?? "개발실습"), important: item.important === true, spaceCode: "COMMON" }),
      });
      if (item.completed) await request(`/api/todos/${created.id}`, { method: "PATCH", body: JSON.stringify({ status: "DONE", expectedVersion: created.version }) });
    })).then(() => {
      window.localStorage.setItem(migrationKey, "done");
      void load();
    }).catch(() => window.localStorage.removeItem(migrationKey));
  }, [isLoading, load, todos.length, user?.email]);

  const addTodo = useCallback(async (title: string, streamOrCategory: TodoWorkstream | TodoCategory = "BACKEND", important = false, nextScope: TodoScope = scope ?? {}) => {
    const isLegacy = ["노트정리", "개발실습", "학습복습", "아이디어", "일반"].includes(streamOrCategory);
    const workstream = isLegacy ? workstreamFromLegacy(streamOrCategory as TodoCategory) : streamOrCategory as TodoWorkstream;
    try {
      const created = normalizeTodo(await request<ApiTodo>("/api/todos", { method: "POST", body: JSON.stringify({ title, workstream, important, ...nextScope }) }));
      setTodos((current) => [created, ...current]);
      showToast("새 작업을 추가했습니다.");
      return created;
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : "작업을 추가하지 못했습니다.", "error");
      return null;
    }
  }, [scope, showToast]);

  const updateTodo = useCallback(async (id: number | string, patch: TodoPatch) => {
    const current = todos.find((todo) => todo.id === Number(id));
    if (!current) return null;
    try {
      const updated = normalizeTodo(await request<ApiTodo>(`/api/todos/${current.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...patch, expectedVersion: current.version }),
      }));
      setTodos((items) => items.map((todo) => todo.id === updated.id ? updated : todo));
      return updated;
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : "작업을 수정하지 못했습니다.", "error");
      void load();
      return null;
    }
  }, [load, showToast, todos]);

  const toggleComplete = useCallback(async (id: number | string) => {
    const todo = todos.find((item) => item.id === Number(id));
    if (todo) await updateTodo(todo.id, { status: todo.status === "DONE" ? "TODO" : "DONE" });
  }, [todos, updateTodo]);

  const toggleImportant = useCallback(async (id: number | string) => {
    const todo = todos.find((item) => item.id === Number(id));
    if (todo) await updateTodo(todo.id, { important: !todo.important });
  }, [todos, updateTodo]);

  const deleteTodo = useCallback(async (id: number | string) => {
    const todoId = Number(id);
    try {
      await request(`/api/todos/${todoId}`, { method: "DELETE" });
      setTodos((items) => items.filter((todo) => todo.id !== todoId));
      return true;
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : "작업을 삭제하지 못했습니다.", "error");
      return false;
    }
  }, [showToast]);

  const reorderTodos = useCallback(async (ids: number[], workstream: TodoWorkstream) => {
    try {
      const rows = await request<ApiTodo[]>("/api/todos/reorder", {
        method: "POST",
        body: JSON.stringify({
          ids,
          workstream,
          categoryId,
          topicId: categoryId ? null : topicId,
          spaceCode,
        }),
      });
      setTodos(rows.map(normalizeTodo));
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : "작업 순서를 저장하지 못했습니다.", "error");
      void load();
    }
  }, [categoryId, load, showToast, spaceCode, topicId]);

  const clearCompleted = useCallback(async () => {
    await Promise.all(todos.filter((todo) => todo.status === "DONE").map((todo) => deleteTodo(todo.id)));
  }, [deleteTodo, todos]);

  const totalCount = todos.length;
  const completedCount = todos.filter((todo) => todo.status === "DONE").length;
  const activeCount = totalCount - completedCount;
  const importantCount = todos.filter((todo) => todo.important && todo.status !== "DONE").length;
  const progressPercent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  return { todos, isLoading, error, reload: load, addTodo, updateTodo, toggleComplete, toggleImportant, deleteTodo, reorderTodos, clearCompleted, totalCount, completedCount, activeCount, importantCount, progressPercent };
}
