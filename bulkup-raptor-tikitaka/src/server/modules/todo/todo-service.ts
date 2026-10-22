import "server-only";

import { and, asc, eq, like, max, or } from "drizzle-orm";
import { users, workTodos } from "@/db/schema";
import { db } from "@/server/database";

// Security는 인증·인가처럼 여러 구현 계층을 가로지르는 독립 작업 축이다.
export const WORKSTREAMS = ["SECURITY", "BACKEND", "FRONTEND", "API", "DEVOPS", "POLICY"] as const;
export type Workstream = (typeof WORKSTREAMS)[number];
export const TODO_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;
export type TodoStatus = (typeof TODO_STATUSES)[number];

export type TodoChecklistItem = {
  id: string;
  text: string;
  completed: boolean;
  layer: string;
};

export type TodoVerificationCheck = {
  id: string;
  text: string;
  passed: boolean;
  evidence: string;
};

export type TodoApiSpec = {
  id: string;
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  purpose: string;
  implemented: boolean;
  tested: boolean;
};

export type TodoScope = {
  spaceCode?: string;
  categoryId?: number | null;
  categoryTitle?: string | null;
  topicId?: number | null;
  topicTitle?: string | null;
  documentId?: number | null;
  documentTitle?: string | null;
};

export type WorkTodo = Omit<typeof workTodos.$inferSelect, "checklistJson" | "apiSpecsJson" | "verificationChecksJson" | "relatedFilesJson" | "relatedApiRequestIdsJson"> & {
  checklist: TodoChecklistItem[];
  apiSpecs: TodoApiSpec[];
  verificationChecks: TodoVerificationCheck[];
  relatedFiles: string[];
  relatedApiRequestIds: number[];
};

export type CreateTodoInput = TodoScope & {
  title?: unknown;
  workstream?: unknown;
  important?: unknown;
  description?: unknown;
  acceptanceCriteria?: unknown;
};

export type UpdateTodoInput = Partial<TodoScope> & {
  title?: unknown;
  workstream?: unknown;
  important?: unknown;
  description?: unknown;
  status?: unknown;
  checklist?: unknown;
  apiSpecs?: unknown;
  acceptanceCriteria?: unknown;
  verificationChecks?: unknown;
  blockerReason?: unknown;
  relatedFiles?: unknown;
  relatedApiRequestIds?: unknown;
  verificationSummary?: unknown;
  expectedVersion?: unknown;
  updatedByType?: unknown;
};

export class TodoError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const text = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

function integer(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function jsonArray<T>(raw: string, fallback: T[]) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
}

function checklist(value: unknown): TodoChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const itemText = text(record.text, 240);
    if (!itemText) return [];
    return [{
      id: text(record.id, 80) || `check-${index + 1}`,
      text: itemText,
      completed: record.completed === true,
      layer: text(record.layer, 40) || "기타",
    }];
  });
}

function verificationChecks(value: unknown): TodoVerificationCheck[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const itemText = text(record.text, 240);
    if (!itemText) return [];
    return [{
      id: text(record.id, 80) || `verification-${index + 1}`,
      text: itemText,
      passed: record.passed === true,
      evidence: text(record.evidence, 600),
    }];
  });
}

function apiSpecs(value: unknown): TodoApiSpec[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const method = text(record.method, 10).toUpperCase();
    const path = text(record.path, 240);
    const purpose = text(record.purpose, 240);
    if (!(["GET", "POST", "PATCH", "PUT", "DELETE"] as const).includes(method as TodoApiSpec["method"]) || !path || !purpose) return [];
    return [{ id: text(record.id, 80) || `api-${index + 1}`, method: method as TodoApiSpec["method"], path, purpose, implemented: record.implemented === true, tested: record.tested === true }];
  });
}

function strings(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).flatMap((item) => {
    const normalized = text(item, maxLength);
    return normalized ? [normalized] : [];
  });
}

function numberList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).flatMap((item) => (integer(item) ? [item as number] : []));
}

function workstream(value: unknown, fallback: Workstream = "BACKEND"): Workstream {
  return typeof value === "string" && WORKSTREAMS.includes(value as Workstream)
    ? value as Workstream
    : fallback;
}

function status(value: unknown, fallback: TodoStatus = "TODO"): TodoStatus {
  return typeof value === "string" && TODO_STATUSES.includes(value as TodoStatus)
    ? value as TodoStatus
    : fallback;
}

function scope(input: TodoScope): Required<Pick<TodoScope, "spaceCode">> & TodoScope {
  return {
    spaceCode: text(input.spaceCode, 80) || "COMMON",
    categoryId: integer(input.categoryId),
    categoryTitle: text(input.categoryTitle, 160) || null,
    topicId: integer(input.topicId),
    topicTitle: text(input.topicTitle, 160) || null,
    documentId: integer(input.documentId),
    documentTitle: text(input.documentTitle, 160) || null,
  };
}

function serialize(row: typeof workTodos.$inferSelect): WorkTodo {
  return {
    ...row,
    checklist: checklist(jsonArray<unknown>(row.checklistJson, [])),
    apiSpecs: apiSpecs(jsonArray<unknown>(row.apiSpecsJson, [])),
    verificationChecks: verificationChecks(jsonArray<unknown>(row.verificationChecksJson, [])),
    relatedFiles: strings(jsonArray<unknown>(row.relatedFilesJson, []), 30, 260),
    relatedApiRequestIds: numberList(jsonArray<unknown>(row.relatedApiRequestIdsJson, [])),
  };
}

function now() {
  return new Date().toISOString();
}

export async function listTodos(userId: number, filters: { spaceCode?: unknown; categoryId?: number | null; topicId?: number | null; workstream?: unknown; status?: unknown; q?: unknown } = {}) {
  const conditions = [eq(workTodos.userId, userId)];
  const spaceCode = text(filters.spaceCode, 80).toUpperCase();
  if (spaceCode) conditions.push(eq(workTodos.spaceCode, spaceCode));
  const categoryId = integer(filters.categoryId);
  if (categoryId) conditions.push(eq(workTodos.categoryId, categoryId));
  const topicId = integer(filters.topicId);
  if (topicId) conditions.push(eq(workTodos.topicId, topicId));
  if (filters.workstream !== undefined) conditions.push(eq(workTodos.workstream, workstream(filters.workstream)));
  if (filters.status !== undefined) conditions.push(eq(workTodos.status, status(filters.status)));
  const query = text(filters.q, 120);
  if (query) {
    const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    const searchableFields = or(
      like(workTodos.title, pattern),
      like(workTodos.description, pattern),
      like(workTodos.acceptanceCriteria, pattern),
    );
    if (searchableFields) conditions.push(searchableFields);
  }
  const rows = await db.select().from(workTodos).where(and(...conditions)).orderBy(asc(workTodos.orderIdx), asc(workTodos.id));
  return rows.map(serialize);
}

export async function todoContext(userId: number, topicId: number) {
  const todos = await listTodos(userId, { topicId });
  return {
    topicId,
    totalCount: todos.length,
    workstreams: WORKSTREAMS.map((id) => ({
      id,
      totalCount: todos.filter((todo) => todo.workstream === id).length,
      activeCount: todos.filter((todo) => todo.workstream === id && todo.status !== "DONE").length,
      blockedCount: todos.filter((todo) => todo.workstream === id && todo.status === "BLOCKED").length,
      completedCount: todos.filter((todo) => todo.workstream === id && todo.status === "DONE").length,
    })),
  };
}

export async function getTodo(userId: number, id: number) {
  const [row] = await db.select().from(workTodos).where(and(eq(workTodos.id, id), eq(workTodos.userId, userId))).limit(1);
  return row ? serialize(row) : null;
}

export async function createTodo(userId: number, input: CreateTodoInput, updatedByType = "USER") {
  const title = text(input.title, 240);
  if (!title) throw new TodoError(400, "TODO 제목이 필요합니다.");
  const nextScope = scope(input);
  const stream = workstream(input.workstream);
  const latest = await db.select({ orderIdx: max(workTodos.orderIdx) }).from(workTodos)
    .where(and(eq(workTodos.userId, userId), nextScope.topicId ? eq(workTodos.topicId, nextScope.topicId) : undefined, eq(workTodos.workstream, stream)));
  const timestamp = now();
  const [row] = await db.insert(workTodos).values({
    userId,
    ...nextScope,
    workstream: stream,
    title,
    description: text(input.description, 12000),
    acceptanceCriteria: text(input.acceptanceCriteria, 6000),
    apiSpecsJson: "[]",
    verificationChecksJson: "[]",
    important: input.important === true,
    orderIdx: (latest[0]?.orderIdx ?? -1) + 1,
    updatedByType,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).returning();
  return serialize(row);
}

export async function updateTodo(userId: number, id: number, input: UpdateTodoInput, updatedByType = "USER") {
  const current = await getTodo(userId, id);
  if (!current) throw new TodoError(404, "TODO를 찾을 수 없습니다.");
  const expectedVersion = typeof input.expectedVersion === "number" ? input.expectedVersion : null;
  if (expectedVersion === null) throw new TodoError(400, "expectedVersion이 필요합니다.");
  if (current.version !== expectedVersion) throw new TodoError(409, "TODO version이 변경되었습니다. 최신 TODO를 다시 조회하세요.");

  const nextStatus = input.status === undefined ? current.status as TodoStatus : status(input.status, current.status as TodoStatus);
  const nextScope = scope({
    spaceCode: input.spaceCode ?? current.spaceCode,
    categoryId: input.categoryId ?? current.categoryId,
    categoryTitle: input.categoryTitle ?? current.categoryTitle,
    topicId: input.topicId ?? current.topicId,
    topicTitle: input.topicTitle ?? current.topicTitle,
    documentId: input.documentId ?? current.documentId,
    documentTitle: input.documentTitle ?? current.documentTitle,
  });
  const completedAt = nextStatus === "DONE" ? (current.completedAt ?? now()) : null;
  const [row] = await db.update(workTodos).set({
    ...nextScope,
    title: input.title === undefined ? current.title : text(input.title, 240) || current.title,
    workstream: input.workstream === undefined ? current.workstream : workstream(input.workstream, current.workstream as Workstream),
    important: input.important === undefined ? current.important : input.important === true,
    description: input.description === undefined ? current.description : text(input.description, 12000),
    status: nextStatus,
    checklistJson: input.checklist === undefined ? JSON.stringify(current.checklist) : JSON.stringify(checklist(input.checklist)),
    apiSpecsJson: input.apiSpecs === undefined ? JSON.stringify(current.apiSpecs) : JSON.stringify(apiSpecs(input.apiSpecs)),
    acceptanceCriteria: input.acceptanceCriteria === undefined ? current.acceptanceCriteria : text(input.acceptanceCriteria, 6000),
    verificationChecksJson: input.verificationChecks === undefined ? JSON.stringify(current.verificationChecks) : JSON.stringify(verificationChecks(input.verificationChecks)),
    blockerReason: input.blockerReason === undefined ? current.blockerReason : text(input.blockerReason, 3000),
    relatedFilesJson: input.relatedFiles === undefined ? JSON.stringify(current.relatedFiles) : JSON.stringify(strings(input.relatedFiles, 30, 260)),
    relatedApiRequestIdsJson: input.relatedApiRequestIds === undefined ? JSON.stringify(current.relatedApiRequestIds) : JSON.stringify(numberList(input.relatedApiRequestIds)),
    verificationSummary: input.verificationSummary === undefined ? current.verificationSummary : text(input.verificationSummary, 6000),
    completedAt,
    version: current.version + 1,
    updatedByType: text(input.updatedByType, 40) || updatedByType,
    updatedAt: now(),
  }).where(and(eq(workTodos.id, id), eq(workTodos.userId, userId), eq(workTodos.version, current.version))).returning();
  if (!row) throw new TodoError(409, "TODO가 동시에 변경되었습니다. 최신 TODO를 다시 조회하세요.");
  return serialize(row);
}

export async function deleteTodo(userId: number, id: number) {
  const [deleted] = await db.delete(workTodos).where(and(eq(workTodos.id, id), eq(workTodos.userId, userId))).returning();
  if (!deleted) throw new TodoError(404, "TODO를 찾을 수 없습니다.");
}

export async function reorderTodos(userId: number, ids: number[], filters: { spaceCode?: unknown; categoryId?: number | null; topicId?: number | null; workstream?: unknown }) {
  const stream = workstream(filters.workstream);
  const current = (await listTodos(userId, { spaceCode: filters.spaceCode, categoryId: filters.categoryId, topicId: filters.topicId }))
    // 기존 API 분류는 Backend 구현 작업 탭에서 함께 관리한다.
    .filter((todo) => todo.workstream === stream || (stream === "BACKEND" && todo.workstream === "API"));
  if (ids.length !== current.length || ids.some((id) => !current.some((todo) => todo.id === id))) {
    throw new TodoError(400, "같은 범위와 업무 영역의 전체 TODO ID를 전달해야 합니다.");
  }
  const timestamp = now();
  for (const [orderIdx, id] of ids.entries()) {
    await db.update(workTodos).set({ orderIdx, updatedAt: timestamp, version: current.find((todo) => todo.id === id)!.version + 1 })
      .where(and(eq(workTodos.id, id), eq(workTodos.userId, userId)));
  }
  return listTodos(userId, { spaceCode: filters.spaceCode, categoryId: filters.categoryId, topicId: filters.topicId });
}

export async function localAgentUserId() {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.active, true)).orderBy(asc(users.id)).limit(1);
  if (!user) throw new TodoError(404, "활성 사용자를 찾을 수 없습니다.");
  return user.id;
}
