import { request } from "../../shared/api/client";

export type DocumentStatus = "DRAFT" | "APPROVED" | "ARCHIVED";
export type PlaybookSearchScope = "all" | "category" | "topic" | "document";
export type PlaybookDomain = string;
export type PlaybookSpace = { id: number; code: string; name: string };

export type PlaybookDocumentSummary = {
  id: number;
  topicId: number;
  parentId: number | null;
  title: string;
  status: DocumentStatus;
  useForChatbot: boolean;
  orderIdx: number;
  version: number;
  hasContent: boolean;
};

export type PlaybookSearchResult = {
  id: number;
  spaceCode: string;
  categoryId: number;
  categoryTitle: string;
  topicId: number;
  topicTitle: string;
  parentId: number | null;
  title: string;
  excerpt: string;
  matchType: "title" | "body";
  status: DocumentStatus;
  updatedAt: string;
};

export type PlaybookMenuSearchResult = {
  kind: "category" | "topic";
  spaceCode: string;
  categoryId: number;
  categoryTitle: string;
  topicId: number | null;
  topicTitle: string | null;
  score: number;
};

export type PlaybookDocument = PlaybookDocumentSummary & {
  location?: { spaceCode: string; categoryId: number; categoryTitle: string; topicId: number; topicTitle: string } | null;
  content: string;
  createdBy: number | null;
  approvedBy: number | null;
  approvedAt: string | null;
  updatedAt: string;
};

// 샘플은 DB에서 관리하는 템플릿이므로 새 키를 추가해도 프론트 타입을 고칠 필요가 없다.
export type PlaybookSampleKey = string;
export type PlaybookSampleSummary = {
  sampleKey: PlaybookSampleKey;
  documentId: number;
  topicId: number;
  title: string;
  content: string;
  version: number;
  updatedAt: string;
};
export type PlaybookSampleChildDocument = {
  documentId: number;
  parentId: number | null;
  title: string;
  content: string;
  version: number;
  updatedAt: string;
  children: PlaybookSampleChildDocument[];
};
export type PlaybookSampleDocument = PlaybookSampleChildDocument & {
  sampleKey: PlaybookSampleKey;
  topicId: number;
};

export type PlaybookDocumentComment = {
  id: number;
  documentId: number;
  parentId: number | null;
  title: string | null;
  content: string;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
};

export type PlaybookTopic = {
  id: number;
  categoryId: number;
  title: string;
  orderIdx: number;
  documents: PlaybookDocumentSummary[];
};

export type PlaybookCategory = {
  id: number;
  title: string;
  orderIdx: number;
  topics: PlaybookTopic[];
};

const BASE = "/api/hospital-playbook";

export const playbookApi = {
  spaces: () => request<PlaybookSpace[]>(`${BASE}/spaces`, { errorMessage: "플레이북 목록을 불러오지 못했습니다." }),

  createSpace: (code: string, name: string) =>
    request<PlaybookSpace>(`${BASE}/spaces`, {
      method: "POST",
      body: { code, name },
      errorMessage: "플레이북을 만들지 못했습니다.",
    }),

  renameSpace: (id: number, name: string) =>
    request<PlaybookSpace>(`${BASE}/spaces/${id}`, {
      method: "PATCH",
      body: { name },
      errorMessage: "플레이북 이름을 바꾸지 못했습니다.",
    }),

  deleteSpace: (id: number) =>
    request<void>(`${BASE}/spaces/${id}`, { method: "DELETE", errorMessage: "플레이북을 삭제하지 못했습니다." }),

  tree: (domain: PlaybookDomain) => request<PlaybookCategory[]>(`${BASE}?spaceCode=${domain}`, { errorMessage: "플레이북을 불러오지 못했습니다." }),

  document: (id: number) =>
    request<PlaybookDocument>(`${BASE}/documents/${id}`, { errorMessage: "문서를 불러오지 못했습니다." }),

  sampleDocument: (sampleKey: PlaybookSampleKey) =>
    request<PlaybookSampleDocument>(`/api/llm/hospital-playbook/samples/${sampleKey}`, {
      errorMessage: "구현 노트 샘플을 불러오지 못했습니다.",
    }),

  sampleDocuments: () =>
    request<PlaybookSampleSummary[]>("/api/llm/hospital-playbook/samples", {
      errorMessage: "노트 샘플 목록을 불러오지 못했습니다.",
    }),

  createSampleDocument: (sampleKey: string, title: string, content?: string) =>
    request<PlaybookSampleSummary>("/api/llm/hospital-playbook/samples", {
      method: "POST", body: { sampleKey, title, content }, errorMessage: "예제를 추가하지 못했습니다.",
    }),

  deleteSampleDocument: (sampleKey: string) =>
    request<void>(`/api/llm/hospital-playbook/samples/${sampleKey}`, {
      method: "DELETE", errorMessage: "예제를 삭제하지 못했습니다.",
    }),

  updateSampleDocument: (currentKey: string, body: { sampleKey: string; title: string; content: string; expectedVersion: number }) =>
    request<PlaybookSampleSummary>(`/api/llm/hospital-playbook/samples/${currentKey}`, {
      method: "PATCH", body, errorMessage: "예제를 저장하지 못했습니다.",
    }),

  search: (keyword: string, domain: PlaybookDomain) =>
    request<PlaybookSearchResult[]>(`${BASE}/search?q=${encodeURIComponent(keyword)}&scope=document&spaceCode=${domain}`, {
      errorMessage: "노트 검색에 실패했습니다.",
    }),

  searchAll: (keyword: string) =>
    request<PlaybookMenuSearchResult[]>(`${BASE}/search?q=${encodeURIComponent(keyword)}&scope=menu`, {
      errorMessage: "메뉴 검색에 실패했습니다.",
    }),

  shareDocument: (id: number) =>
    request<{ token: string }>(`${BASE}/documents/${id}/share`, {
      method: "POST",
      errorMessage: "공유 링크를 만들지 못했습니다.",
    }),

  createCategory: (domain: PlaybookDomain, title: string) =>
    request<PlaybookCategory>(`${BASE}/categories?spaceCode=${domain}`, {
      method: "POST",
      body: { title },
      errorMessage: "영역을 만들지 못했습니다.",
    }),

  renameCategory: (id: number, title: string) =>
    request<PlaybookCategory>(`${BASE}/categories/${id}`, {
      method: "PATCH",
      body: { title },
      errorMessage: "영역 이름을 바꾸지 못했습니다.",
    }),

  deleteCategory: (id: number) =>
    request<void>(`${BASE}/categories/${id}`, { method: "DELETE", errorMessage: "영역을 삭제하지 못했습니다." }),

  reorderCategories: (ids: number[]) =>
    request<void>(`${BASE}/categories/reorder`, {
      method: "POST",
      body: { ids },
      errorMessage: "영역 순서를 저장하지 못했습니다.",
    }),

  createTopic: (categoryId: number, title: string) =>
    request<PlaybookTopic>(`${BASE}/categories/${categoryId}/topics`, {
      method: "POST",
      body: { title },
      errorMessage: "주제를 만들지 못했습니다.",
    }),

  renameTopic: (id: number, title: string) =>
    request<PlaybookTopic>(`${BASE}/topics/${id}`, {
      method: "PATCH",
      body: { title },
      errorMessage: "주제 이름을 바꾸지 못했습니다.",
    }),

  moveTopic: (id: number, categoryId: number) =>
    request<PlaybookTopic>(`${BASE}/topics/${id}`, {
      method: "PATCH",
      body: { categoryId },
      errorMessage: "2차 메뉴를 이동하지 못했습니다.",
    }),

  deleteTopic: (id: number) =>
    request<void>(`${BASE}/topics/${id}`, { method: "DELETE", errorMessage: "주제를 삭제하지 못했습니다." }),

  reorderTopics: (categoryId: number, ids: number[]) =>
    request<void>(`${BASE}/categories/${categoryId}/topics/reorder`, {
      method: "POST",
      body: { ids },
      errorMessage: "주제 순서를 저장하지 못했습니다.",
    }),

  createDocument: (topicId: number, title: string, parentId: number | null = null, content?: string) =>
    request<PlaybookDocument>(`${BASE}/topics/${topicId}/documents`, {
      method: "POST",
      body: { title, parentId, content },
      errorMessage: "문서를 만들지 못했습니다.",
    }),

  updateDocument: (id: number, patch: { title?: string; content?: string; useForChatbot?: boolean; parentId?: number | null }) =>
    request<PlaybookDocument>(`${BASE}/documents/${id}`, {
      method: "PATCH",
      body: patch,
      errorMessage: "문서를 저장하지 못했습니다.",
    }),

  moveDocumentToTopic: (id: number, topicId: number) =>
    request<PlaybookDocument>(`${BASE}/documents/${id}`, {
      method: "PATCH",
      body: { topicId },
      errorMessage: "문서를 다른 2차 메뉴로 이동하지 못했습니다.",
    }),

  approveDocument: (id: number) =>
    request<PlaybookDocument>(`${BASE}/documents/${id}/approve`, {
      method: "POST",
      errorMessage: "문서를 승인하지 못했습니다.",
    }),

  deleteDocument: (id: number) =>
    request<void>(`${BASE}/documents/${id}`, { method: "DELETE", errorMessage: "문서를 삭제하지 못했습니다." }),

  comments: (documentId: number) =>
    request<PlaybookDocumentComment[]>(`${BASE}/comments?documentId=${documentId}`, { errorMessage: "댓글을 불러오지 못했습니다." }),

  createComment: (documentId: number, body: { title?: string; content: string; parentId?: number | null }) =>
    request<PlaybookDocumentComment>(`${BASE}/comments`, {
      method: "POST",
      body: { ...body, documentId },
      errorMessage: "댓글을 등록하지 못했습니다.",
    }),

  updateComment: (id: number, body: { title?: string; content: string }) =>
    request<PlaybookDocumentComment>(`${BASE}/comments/${id}`, {
      method: "PATCH",
      body,
      errorMessage: "댓글을 수정하지 못했습니다.",
    }),

  deleteComment: (id: number) =>
    request<void>(`${BASE}/comments/${id}`, { method: "DELETE", errorMessage: "댓글을 삭제하지 못했습니다." }),

  reorderDocuments: (topicId: number, ids: number[], parentId: number | null = null) =>
    request<void>(`${BASE}/topics/${topicId}/documents/reorder`, {
      method: "POST",
      body: { ids, parentId },
      errorMessage: "문서 순서를 저장하지 못했습니다.",
    }),
};
