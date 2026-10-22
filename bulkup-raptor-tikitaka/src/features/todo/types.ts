// Security는 인증·인가처럼 Backend·Frontend·Policy를 함께 가로지르는 작업 축이다.
export const WORKSTREAMS = ["SECURITY", "BACKEND", "FRONTEND", "API", "DEVOPS", "POLICY"] as const;
export type TodoWorkstream = (typeof WORKSTREAMS)[number];
// API는 구현 작업의 담당 영역이 아니라 계약·검증 산출물이다.
// 기존 API 분류 데이터는 Backend 작업 탭에서 호환해 보여 준다.
// API는 Backend 탭에 호환해 보여 주고, Security는 우선 작업 축으로 먼저 노출한다.
export const TASK_WORKSTREAMS = ["SECURITY", "BACKEND", "FRONTEND", "DEVOPS", "POLICY"] as const;

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
  /** 맨왼쪽 작업 영역의 표시 이름. 1·2차 메뉴는 TODO 목록 범위를 바꾸지 않는다. */
  spaceTitle?: string;
  categoryId?: number | null;
  categoryTitle?: string | null;
  topicId?: number | null;
  topicTitle?: string | null;
  /** 목록은 같은 1차 메뉴 전체에서 보고, 새 작업은 현재 topic에 연결한다. */
  includeCategoryTodos?: boolean;
  documentId?: number | null;
  documentTitle?: string | null;
};

export type TodoItem = TodoScope & {
  id: number;
  userId: number;
  workstream: TodoWorkstream;
  title: string;
  description: string;
  status: TodoStatus;
  important: boolean;
  checklist: TodoChecklistItem[];
  apiSpecs: TodoApiSpec[];
  acceptanceCriteria: string;
  verificationChecks: TodoVerificationCheck[];
  blockerReason: string;
  relatedFiles: string[];
  relatedApiRequestIds: number[];
  verificationSummary: string;
  orderIdx: number;
  version: number;
  updatedByType: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  // 기존 전체 TODO 화면 호환용 파생 필드다.
  category: TodoCategory;
  completed: boolean;
};

export type TodoCategory = "노트정리" | "개발실습" | "학습복습" | "아이디어" | "일반";

export const TODO_CATEGORIES: Array<{ id: TodoCategory; label: string; badgeClass: string }> = [
  { id: "노트정리", label: "노트정리", badgeClass: "bg-blue-500/10 text-blue-600 border-blue-200" },
  { id: "개발실습", label: "개발실습", badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
  { id: "학습복습", label: "학습복습", badgeClass: "bg-amber-500/10 text-amber-600 border-amber-200" },
  { id: "아이디어", label: "아이디어", badgeClass: "bg-purple-500/10 text-purple-600 border-purple-200" },
  { id: "일반", label: "일반", badgeClass: "bg-zinc-500/10 text-zinc-600 border-zinc-200" },
];

export const WORKSTREAM_META: Record<TodoWorkstream, { label: string; badgeClass: string }> = {
  SECURITY: { label: "Security", badgeClass: "bg-red-500/10 text-red-700 border-red-200" },
  BACKEND: { label: "Backend", badgeClass: "bg-sky-500/10 text-sky-700 border-sky-200" },
  FRONTEND: { label: "Frontend", badgeClass: "bg-violet-500/10 text-violet-700 border-violet-200" },
  API: { label: "API", badgeClass: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  DEVOPS: { label: "DevOps", badgeClass: "bg-amber-500/10 text-amber-700 border-amber-200" },
  POLICY: { label: "Policy", badgeClass: "bg-rose-500/10 text-rose-700 border-rose-200" },
};

export const STATUS_META: Record<TodoStatus, { label: string; className: string }> = {
  TODO: { label: "대기", className: "text-text-muted" },
  IN_PROGRESS: { label: "진행", className: "text-brand-primary" },
  BLOCKED: { label: "막힘", className: "text-destructive" },
  DONE: { label: "완료", className: "text-emerald-600" },
};

export const LEGACY_TODOS = [
  { title: "오늘 학습할 스프링 부트 핵심 개념 문서 목록 정리하기", category: "노트정리", important: true, completed: false },
  { title: "REST API 컨트롤러 및 서비스 레이어 코드 실습 작성", category: "개발실습", important: false, completed: false },
  { title: "작성한 코드 복습 및 핵심 문서 북마크 추가하기", category: "학습복습", important: false, completed: true },
] as const;

export const INITIAL_TODOS = [
  { id: "seed-1", title: "오늘 학습할 스프링 부트 핵심 개념 문서 목록 정리하기", category: "노트정리" as TodoCategory, important: true, completed: false, createdAt: new Date().toISOString() },
  { id: "seed-2", title: "REST API 컨트롤러 및 서비스 레이어 코드 실습 작성", category: "개발실습" as TodoCategory, important: false, completed: false, createdAt: new Date().toISOString() },
  { id: "seed-3", title: "작성한 코드 복습 및 핵심 문서 북마크 추가하기", category: "학습복습" as TodoCategory, important: false, completed: true, createdAt: new Date().toISOString(), completedAt: new Date().toISOString() },
];
