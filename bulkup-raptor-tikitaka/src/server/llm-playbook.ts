import "server-only";

import { LlmPlaybookError } from "@/server/http/llm-request";
export { assertLlmApiAccess, handleLlmRequest, llmErrorResponse, LlmPlaybookError } from "@/server/http/llm-request";
import type { playbookDocuments } from "@/db/schema";
import * as repository from "@/server/modules/playbook/playbook-repository";
import { moveDocumentToTopic as moveDocumentToTopicService, PlaybookServiceError } from "@/server/modules/playbook/playbook-service";

const documentSummary = (document: typeof playbookDocuments.$inferSelect) => ({
  id: document.id,
  topicId: document.topicId,
  parentId: document.parentId,
  title: document.title,
  status: document.status,
  useForChatbot: document.useForChatbot,
  orderIdx: document.orderIdx,
  version: document.version,
});

const documentResponse = (document: typeof playbookDocuments.$inferSelect) => ({
  ...documentSummary(document),
  content: document.content,
  createdBy: document.createdBy,
  approvedBy: document.approvedBy,
  approvedAt: document.approvedAt,
  updatedAt: document.updatedAt,
});

type PlaybookSampleChild = {
  documentId: number;
  parentId: number | null;
  title: string;
  content: string;
  version: number;
  updatedAt: string;
  children: PlaybookSampleChild[];
};

export async function llmTree(spaceCode: string) {
  const space = await repository.findSpaceByCode(spaceCode.trim().toUpperCase());
  if (!space) throw new LlmPlaybookError(404, "플레이북을 찾을 수 없습니다.");
  const categories = await repository.listCategoriesBySpace(space.id);
  const topics = await repository.listAllTopics();
  const documents = await repository.listAllDocuments();
  return categories.map((category) => ({
    ...category,
    topics: topics.filter((topic) => topic.categoryId === category.id).map((topic) => ({
      ...topic,
      documents: documents.filter((document) => document.topicId === topic.id).map(documentSummary),
    })),
  }));
}

export async function llmCategory(categoryId: number) {
  const category = await repository.findCategoryById(categoryId);
  if (!category) throw new LlmPlaybookError(404, "1차 메뉴를 찾을 수 없습니다.");
  const topics = (await repository.listAllTopics()).filter((topic) => topic.categoryId === categoryId);
  const documents = await repository.listAllDocuments();
  return { ...category, topics: topics.map((topic) => ({ ...topic, documents: documents.filter((document) => document.topicId === topic.id).map(documentSummary) })) };
}

export async function llmTopic(topicId: number) {
  const topic = await repository.findTopicById(topicId);
  if (!topic) throw new LlmPlaybookError(404, "2차 주제를 찾을 수 없습니다.");
  const documents = await repository.listDocumentsByTopic(topicId);
  return { ...topic, documents: documents.map(documentSummary) };
}

export async function moveLlmTopic(topicId: number, targetCategoryId: number) {
  if (!Number.isInteger(topicId) || !Number.isInteger(targetCategoryId)) throw new LlmPlaybookError(400, "2차 메뉴 ID와 이동할 1차 메뉴 ID가 필요합니다.");
  const topic = await repository.findTopicById(topicId);
  const sourceCategory = topic ? await repository.findCategoryById(topic.categoryId) : null;
  const targetCategory = await repository.findCategoryById(targetCategoryId);
  if (!topic || !sourceCategory) throw new LlmPlaybookError(404, "2차 메뉴를 찾을 수 없습니다.");
  if (!targetCategory) throw new LlmPlaybookError(404, "이동할 1차 메뉴를 찾을 수 없습니다.");
  if (sourceCategory.id === targetCategory.id) throw new LlmPlaybookError(400, "현재 1차 메뉴와 다른 위치를 선택하세요.");
  if (sourceCategory.spaceId !== targetCategory.spaceId) throw new LlmPlaybookError(400, "같은 플레이북 안의 1차 메뉴로만 이동할 수 있습니다.");

  const space = await repository.findSpaceById(sourceCategory.spaceId);
  if (space && ["UI_NAV", "UI_FORM", "UI_LAYOUT", "UI_STATE"].includes(space.code)) throw new LlmPlaybookError(403, "공통 UI 시스템 갤러리의 주제는 이동할 수 없습니다.");
  const duplicate = (await repository.listAllTopics()).some((item) => item.categoryId === targetCategoryId && item.title === topic.title);
  if (duplicate) throw new LlmPlaybookError(409, "이동할 1차 메뉴에 같은 이름의 2차 메뉴가 있습니다.");
  return repository.moveTopic(topicId, targetCategoryId);
}

/** 선택한 2차 주제의 전체 문서 트리와 LLM 조회 URL을 한 번에 제공한다. */
export async function llmTopicDocumentTree(topicId: number, apiOrigin: string) {
  const topic = await repository.findTopicById(topicId);
  if (!topic) throw new LlmPlaybookError(404, "2차 주제를 찾을 수 없습니다.");
  const documents = await repository.listDocumentsByTopic(topicId);
  const apiBase = `${apiOrigin}/api/llm/hospital-playbook`;
  const node = (current: typeof playbookDocuments.$inferSelect): Record<string, unknown> => ({
    ...documentSummary(current),
    documentUrl: `${apiBase}/documents/${current.id}`,
    contextUrl: `${apiBase}/documents/${current.id}/context`,
    contentUrl: `${apiBase}/documents/${current.id}/content`,
    children: documents.filter((child) => child.parentId === current.id).map(node),
  });

  return {
    ...topic,
    topicId: topic.id,
    apiBaseUrl: apiBase,
    topicUrl: `${apiBase}/topics/${topic.id}`,
    documentsUrl: `${apiBase}/topics/${topic.id}/documents`,
    documents: documents.filter((document) => document.parentId === null).map(node),
  };
}

export async function llmDocument(documentId: number) {
  const document = await repository.findDocument(documentId);
  if (!document) throw new LlmPlaybookError(404, "문서를 찾을 수 없습니다.");
  return documentResponse(document);
}

export async function moveLlmDocumentToTopic(documentId: number, targetTopicId: number) {
  if (!Number.isInteger(documentId) || !Number.isInteger(targetTopicId)) throw new LlmPlaybookError(400, "문서 ID와 이동할 2차 메뉴 ID가 필요합니다.");
  try {
    const moved = await moveDocumentToTopicService(documentId, targetTopicId);
    if (!moved) throw new LlmPlaybookError(404, "문서를 찾을 수 없습니다.");
    return documentResponse(moved);
  } catch (error) {
    if (error instanceof PlaybookServiceError) throw new LlmPlaybookError(error.status, error.message);
    throw error;
  }
}

export async function llmDocumentContext(documentId: number) {
  const document = await llmDocument(documentId);
  const topic = await repository.findTopicById(document.topicId);
  const category = topic ? await repository.findCategoryById(topic.categoryId) : null;
  if (!topic || !category) throw new LlmPlaybookError(404, "문서 위치를 찾을 수 없습니다.");
  const spaces = await repository.listSpaces();
  const resolvedSpace = spaces.find((item) => item.id === category.spaceId);
  if (!resolvedSpace) throw new LlmPlaybookError(404, "플레이북을 찾을 수 없습니다.");
  const documents = await repository.listDocumentsByTopic(topic.id);
  const node = (current: typeof playbookDocuments.$inferSelect): Record<string, unknown> => ({
    ...documentResponse(current),
    children: documents.filter((child) => child.parentId === current.id).map(node),
  });
  const current = documents.find((item) => item.id === documentId);
  if (!current) throw new LlmPlaybookError(404, "문서를 찾을 수 없습니다.");
  return { spaceCode: resolvedSpace.code, spaceName: resolvedSpace.name, categoryId: category.id, categoryTitle: category.title, topicId: topic.id, topicTitle: topic.title, document: node(current) };
}

export async function createLlmStructure(spaceCode: string, categoryTitle: string, topicTitles: string[]) {
  const space = await repository.findSpaceByCode(spaceCode.trim().toUpperCase());
  if (!space) throw new LlmPlaybookError(404, "플레이북을 찾을 수 없습니다.");
  const category = await repository.insertCategory(space.id, categoryTitle.trim(), await repository.countCategoriesBySpace(space.id));
  const topics = [];
  for (const [index, title] of topicTitles.map((item) => item.trim()).filter(Boolean).entries()) {
    const topic = await repository.insertTopic(category.id, title, index);
    topics.push({ ...topic, documents: [] });
  }
  return { category: { ...category, topics }, topics };
}

// 기존 1차 메뉴 아래에 2차 주제를 추가할 때는 구조를 중복 생성하지 않는다.
export async function createLlmTopic(categoryId: number, title: string) {
  const category = await repository.findCategoryById(categoryId);
  if (!category) throw new LlmPlaybookError(404, "1차 메뉴를 찾을 수 없습니다.");
  const normalizedTitle = title.trim();
  if (!normalizedTitle) throw new LlmPlaybookError(400, "2차 주제 제목이 필요합니다.");
  const topics = (await repository.listAllTopics()).filter((topic) => topic.categoryId === categoryId);
  if (topics.some((topic) => topic.title === normalizedTitle)) {
    throw new LlmPlaybookError(409, "같은 이름의 2차 주제가 이미 있습니다.");
  }
  return { ...(await repository.insertTopic(categoryId, normalizedTitle, topics.length)), documents: [] };
}

export async function createLlmDocument(topicId: number, title: string, content: string, parentId: number | null) {
  const topic = await repository.findTopicById(topicId);
  if (!topic) throw new LlmPlaybookError(404, "2차 주제를 찾을 수 없습니다.");
  if (parentId !== null) {
    const parent = await repository.findParentDocument(parentId, topicId);
    if (!parent) throw new LlmPlaybookError(400, "같은 주제의 상위 문서만 지정할 수 있습니다.");
  }
  const siblings = await repository.countDocumentsByTopic(topicId);
  const orderIdx = siblings.filter((document) => document.parentId === parentId).length;
  const now = new Date().toISOString();
  const document = await repository.createDocument(topicId, title.trim(), parentId, null, content, orderIdx);
  return documentResponse(document);
}

export async function updateLlmDocument(documentId: number, title: string | undefined, content: string, expectedVersion: number | undefined, parentId: number | null | undefined) {
  const current = await llmDocument(documentId);
  if (expectedVersion !== undefined && current.version !== expectedVersion) throw new LlmPlaybookError(409, "문서 version이 변경되었습니다. 최신 문서를 다시 조회하세요.");
  if (parentId !== undefined && parentId !== null) {
    if (parentId === documentId) throw new LlmPlaybookError(400, "문서 자신을 상위 문서로 지정할 수 없습니다.");
    const parent = await repository.findParentDocument(parentId, current.topicId);
    if (!parent) throw new LlmPlaybookError(400, "같은 주제의 상위 문서만 지정할 수 있습니다.");
  }
  const updated = await repository.updateDocument(documentId, {
    title: title?.trim() || current.title,
    content,
    parentId: parentId === undefined ? current.parentId : parentId,
    version: current.version + 1,
  });
  return documentResponse(updated!);
}

export async function deleteLlmDocument(documentId: number) {
  const targets = await repository.findDocumentTreeIds(documentId);
  if (!targets) throw new LlmPlaybookError(404, "문서를 찾을 수 없습니다.");
  await repository.deleteDocumentTree(targets);
}

// 로컬 LLM 관리 API에서도 메뉴 구조를 정리할 수 있도록 1차 메뉴를 함께 삭제한다.
export async function deleteLlmCategory(categoryId: number) {
  if (!Number.isInteger(categoryId)) throw new LlmPlaybookError(400, "1차 메뉴 ID가 올바르지 않습니다.");
  const deleted = await repository.deleteCategory(categoryId);
  if (!deleted) throw new LlmPlaybookError(404, "1차 메뉴를 찾을 수 없습니다.");
}

// 2차 메뉴 삭제는 연결된 본문 문서와 댓글까지 정리한다.
export async function deleteLlmTopic(topicId: number) {
  if (!Number.isInteger(topicId)) throw new LlmPlaybookError(400, "2차 주제 ID가 올바르지 않습니다.");
  const deleted = await repository.deleteTopic(topicId);
  if (!deleted) throw new LlmPlaybookError(404, "2차 주제를 찾을 수 없습니다.");
}

export async function reorderLlmDocuments(topicId: number, ids: number[], parentId: number | null) {
  const documents = await repository.countDocumentsByTopic(topicId);
  const siblings = documents.filter((document) => document.parentId === parentId);
  const siblingIds = new Set(siblings.map((document) => document.id));
  if (ids.length !== siblings.length || ids.some((id) => !siblingIds.has(id))) throw new LlmPlaybookError(400, "같은 상위 문서 아래의 전체 문서 ID를 전달해야 합니다.");
  const now = new Date().toISOString();
  for (const [orderIdx, id] of ids.entries()) await repository.updateDocumentOrder(id, orderIdx, now);
}

export async function llmSamples() {
  const documents = await repository.listSampleDocuments();
  return documents.map((document) => ({ sampleKey: document.sampleKey, documentId: document.id, topicId: document.topicId, title: document.title, content: document.content, version: document.version, updatedAt: document.updatedAt }));
}

export async function llmSample(sampleKey: string) {
  const document = await repository.findSampleDocument(sampleKey.trim().toUpperCase());
  if (!document) throw new LlmPlaybookError(404, "샘플 문서를 찾을 수 없습니다.");
  const documents = await repository.listDocumentsByTopic(document.topicId);
  const childNode = (current: typeof playbookDocuments.$inferSelect): PlaybookSampleChild => ({
    documentId: current.id,
    parentId: current.parentId,
    title: current.title,
    content: current.content,
    version: current.version,
    updatedAt: current.updatedAt,
    children: documents.filter((child) => child.parentId === current.id).map(childNode),
  });
  return { sampleKey: document.sampleKey, topicId: document.topicId, ...childNode(document) };
}

const EMPTY_LEXICAL_STATE = JSON.stringify({ root: { children: [], direction: null, format: "", indent: 0, type: "root", version: 1 } });

export async function createLlmSample(sampleKey: string, title: string, content = EMPTY_LEXICAL_STATE) {
  const normalizedKey = sampleKey.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(normalizedKey)) throw new LlmPlaybookError(400, "예제 키는 영문 대문자, 숫자, 밑줄로 3~64자여야 합니다.");
  if (!title.trim()) throw new LlmPlaybookError(400, "예제 제목이 필요합니다.");
  if (await repository.findSampleDocument(normalizedKey)) throw new LlmPlaybookError(409, "같은 예제 키가 이미 있습니다.");
  const document = await repository.createSampleDocument(normalizedKey, title.trim(), content);
  return { sampleKey: normalizedKey, documentId: document.id, topicId: document.topicId, title: document.title, content: document.content, version: document.version, updatedAt: document.updatedAt };
}

export async function deleteLlmSample(sampleKey: string) {
  const document = await repository.findSampleDocument(sampleKey.trim().toUpperCase());
  if (!document?.sampleKey) throw new LlmPlaybookError(404, "샘플 문서를 찾을 수 없습니다.");
  await repository.addSampleTombstone(document.sampleKey);
  await deleteLlmDocument(document.id);
}

export async function updateLlmSample(currentKey: string, nextKey: string, title: string, content: string, expectedVersion: number | undefined) {
  const current = await repository.findSampleDocument(currentKey.trim().toUpperCase());
  if (!current?.sampleKey) throw new LlmPlaybookError(404, "샘플 문서를 찾을 수 없습니다.");
  const normalizedKey = nextKey.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(normalizedKey)) throw new LlmPlaybookError(400, "예제 키는 영문 대문자, 숫자, 밑줄로 3~64자여야 합니다.");
  if (!title.trim()) throw new LlmPlaybookError(400, "예제 제목이 필요합니다.");
  if (expectedVersion !== undefined && current.version !== expectedVersion) throw new LlmPlaybookError(409, "예제 version이 변경되었습니다. 최신 예제를 다시 조회하세요.");
  if (normalizedKey !== current.sampleKey && await repository.findSampleDocument(normalizedKey)) throw new LlmPlaybookError(409, "같은 예제 키가 이미 있습니다.");
  const updated = await repository.updateSampleDocument(current.id, { sampleKey: normalizedKey, title: title.trim(), content, version: current.version + 1 });
  if (!updated) throw new LlmPlaybookError(404, "샘플 문서를 찾을 수 없습니다.");
  return { sampleKey: updated.sampleKey!, documentId: updated.id, topicId: updated.topicId, title: updated.title, content: updated.content, version: updated.version, updatedAt: updated.updatedAt };
}
