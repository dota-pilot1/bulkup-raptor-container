import "server-only";

import { createHash, randomBytes } from "node:crypto";
import * as repository from "./playbook-repository";
import { extractSearchText, makeSearchExcerpt } from "./search-text";

export class PlaybookServiceError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function getDocument(id: number) {
  const document = await repository.findDocument(id);
  if (!document) return null;
  const topic = await repository.findTopicById(document.topicId);
  const category = topic ? await repository.findCategoryById(topic.categoryId) : null;
  const space = category ? await repository.findSpaceById(category.spaceId) : null;
  return { ...document, location: topic && category && space ? {
    spaceCode: space.code, categoryId: category.id, categoryTitle: category.title,
    topicId: topic.id, topicTitle: topic.title,
  } : null };
}

export const listSpaces = repository.listSpaces;
export const getTree = repository.getTree;
export const createCategory = repository.createCategory;
export const createTopic = repository.createTopic;
export const renameCategory = repository.renameCategory;
export const renameTopic = repository.renameTopic;
export const reorderCategories = repository.reorderCategories;
export const reorderTopics = repository.reorderTopics;
export const reorderDocuments = repository.reorderDocuments;

const SYSTEM_GALLERY_SPACES = new Set(["UI_NAV", "UI_FORM", "UI_LAYOUT", "UI_STATE"]);

export async function moveTopic(id: number, targetCategoryId: number) {
  const topic = await repository.findTopicById(id);
  const sourceCategory = topic ? await repository.findCategoryById(topic.categoryId) : null;
  const targetCategory = await repository.findCategoryById(targetCategoryId);
  if (!topic || !sourceCategory) throw new PlaybookServiceError(404, "2차 메뉴를 찾을 수 없습니다.");
  if (!targetCategory) throw new PlaybookServiceError(404, "이동할 1차 메뉴를 찾을 수 없습니다.");
  if (sourceCategory.id === targetCategory.id) throw new PlaybookServiceError(400, "현재 1차 메뉴와 다른 위치를 선택하세요.");
  if (sourceCategory.spaceId !== targetCategory.spaceId) throw new PlaybookServiceError(400, "같은 플레이북 안의 1차 메뉴로만 이동할 수 있습니다.");

  const space = await repository.findSpaceById(sourceCategory.spaceId);
  if (space && SYSTEM_GALLERY_SPACES.has(space.code)) throw new PlaybookServiceError(403, "공통 UI 시스템 갤러리의 주제는 이동할 수 없습니다.");

  const duplicate = (await repository.listAllTopics()).some(
    (item) => item.categoryId === targetCategoryId && item.title === topic.title,
  );
  if (duplicate) throw new PlaybookServiceError(409, "이동할 1차 메뉴에 같은 이름의 2차 메뉴가 있습니다.");
  return repository.moveTopic(id, targetCategoryId);
}

async function isProtectedGalleryTopic(topicId: number) {
  const topic = await repository.findTopicById(topicId);
  if (!topic) return false;
  const category = await repository.findCategoryById(topic.categoryId);
  if (!category) return false;
  const space = await repository.findSpaceById(category.spaceId);
  return Boolean(space && SYSTEM_GALLERY_SPACES.has(space.code));
}

export async function deleteCategory(id: number) {
  const category = await repository.findCategoryById(id);
  if (!category) return false;
  const space = await repository.findSpaceById(category.spaceId);
  if (space && SYSTEM_GALLERY_SPACES.has(space.code)) throw new PlaybookServiceError(403, "공통 UI 시스템 갤러리의 영역은 삭제할 수 없습니다.");
  return repository.deleteCategory(id);
}

export async function deleteTopic(id: number) {
  if (await isProtectedGalleryTopic(id)) throw new PlaybookServiceError(403, "공통 UI 시스템 갤러리의 주제는 삭제할 수 없습니다.");
  return repository.deleteTopic(id);
}

export async function createDocument(topicId: number, title: string, parentId: number | null, createdBy: number | null, content?: string) {
  return repository.createDocument(topicId, title, parentId, createdBy, content);
}

export async function updateDocument(id: number, title: string | undefined, content: string | undefined, parentId: number | null | undefined = undefined) {
  const current = await repository.findDocument(id);
  if (!current) throw new PlaybookServiceError(404, "문서를 찾을 수 없습니다.");
  const parentChanged = parentId !== undefined && parentId !== current.parentId;
  if (parentChanged && parentId !== null) {
    const parent = await repository.findParentDocument(parentId, current.topicId);
    if (!parent) throw new PlaybookServiceError(400, "같은 주제의 본문 아래로만 이동할 수 있습니다.");

    const documents = await repository.listDocumentsByTopic(current.topicId);
    const descendants = new Set<number>([current.id]);
    let foundChild = true;
    while (foundChild) {
      foundChild = false;
      for (const document of documents) {
        if (document.parentId !== null && descendants.has(document.parentId) && !descendants.has(document.id)) {
          descendants.add(document.id);
          foundChild = true;
        }
      }
    }
    if (descendants.has(parentId)) throw new PlaybookServiceError(400, "현재 문서 또는 하위 문서 아래로는 이동할 수 없습니다.");
  }
  const siblings = parentChanged ? await repository.listDocumentsByTopic(current.topicId) : [];
  return repository.updateDocument(id, {
    ...(title === undefined ? {} : { title: title.trim().slice(0, 300) }),
    ...(content === undefined ? {} : { content }),
    ...(parentId === undefined ? {} : { parentId }),
    ...(parentChanged ? { orderIdx: siblings.filter((document) => document.parentId === parentId).length } : {}),
    version: current.version + 1,
  });
}

export async function moveDocumentToTopic(id: number, targetTopicId: number) {
  const document = await repository.findDocument(id);
  const sourceTopic = document ? await repository.findTopicById(document.topicId) : null;
  const targetTopic = await repository.findTopicById(targetTopicId);
  if (!document || !sourceTopic) throw new PlaybookServiceError(404, "문서를 찾을 수 없습니다.");
  if (!targetTopic) throw new PlaybookServiceError(404, "이동할 2차 메뉴를 찾을 수 없습니다.");
  if (sourceTopic.id === targetTopic.id) throw new PlaybookServiceError(400, "현재 2차 메뉴와 다른 주제를 선택하세요.");

  const sourceCategory = await repository.findCategoryById(sourceTopic.categoryId);
  const targetCategory = await repository.findCategoryById(targetTopic.categoryId);
  if (!sourceCategory || !targetCategory || sourceCategory.id !== targetCategory.id) {
    throw new PlaybookServiceError(400, "같은 1차 메뉴 안의 2차 메뉴로만 이동할 수 있습니다.");
  }
  if (document.parentId === null && await isProtectedGalleryTopic(document.topicId)) {
    throw new PlaybookServiceError(403, "공통 UI 시스템 갤러리의 대표 문서는 이동할 수 없습니다.");
  }
  return repository.moveDocumentToTopic(id, targetTopicId);
}

export async function deleteDocumentTree(id: number) {
  const document = await repository.findDocument(id);
  if (document?.parentId === null && await isProtectedGalleryTopic(document.topicId)) {
    throw new PlaybookServiceError(403, "공통 UI 시스템 갤러리의 대표 문서는 삭제할 수 없습니다.");
  }
  const ids = await repository.findDocumentTreeIds(id);
  if (!ids) throw new PlaybookServiceError(404, "문서를 찾을 수 없습니다.");
  await repository.deleteDocumentTree(ids);
}

export async function listComments(documentId: number) {
  return repository.listComments(documentId);
}

export async function createComment(input: Parameters<typeof repository.createComment>[0]) {
  return repository.createComment(input);
}

export async function updateComment(id: number, title: string | null, content: string) {
  const comment = await repository.updateComment(id, title, content);
  if (!comment) throw new PlaybookServiceError(404, "댓글을 찾을 수 없습니다.");
  return comment;
}

export async function deleteComment(id: number) {
  await repository.deleteComment(id);
}

export async function issueAiEditToken(id: number, userId: number, isAdmin: boolean) {
  const document = await repository.findDocument(id);
  if (!document) throw new PlaybookServiceError(404, "문서를 찾을 수 없습니다.");
  if (!isAdmin && document.createdBy !== userId) {
    throw new PlaybookServiceError(403, "작성자 또는 관리자만 발급할 수 있습니다.");
  }
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await repository.issueAiEditToken(id, tokenHash, expiresAt);
  return { token, documentId: id, expectedVersion: document.version, expiresAt };
}

export async function searchDocuments(keyword: string, spaceCode: string | null) {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase();
  if (!normalizedKeyword) return [];
  const rows = await repository.searchDocuments(keyword, spaceCode);
  return rows
    .flatMap(({ document, topic, category, space }) => {
      const title = document.title.toLocaleLowerCase();
      const body = extractSearchText(document.content);
      const bodyIndex = body.toLocaleLowerCase().indexOf(normalizedKeyword);
      const titleScore = title === normalizedKeyword ? 1_000 : title.startsWith(normalizedKeyword) ? 800 : title.includes(normalizedKeyword) ? 600 : 0;
      const score = titleScore || (bodyIndex >= 0 ? 100 : 0);
      if (!score) return [];
      return [{
        id: document.id,
        parentId: document.parentId,
        title: document.title,
        excerpt: titleScore ? makeSearchExcerpt(body, normalizedKeyword) : makeSearchExcerpt(body, normalizedKeyword),
        matchType: titleScore ? "title" : "body",
        score,
        status: document.status,
        updatedAt: document.updatedAt,
        topicId: topic.id,
        topicTitle: topic.title,
        categoryId: category.id,
        categoryTitle: category.title,
        spaceCode: space.code,
      }];
    })
    .sort((left, right) => right.score - left.score || right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 30);
}

export async function searchMenuEntries(keyword: string) {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase();
  if (!normalizedKeyword) return [];
  const rows = await repository.listSearchMenus();
  const results = new Map<string, { kind: "category" | "topic"; spaceCode: string; categoryId: number; categoryTitle: string; topicId: number | null; topicTitle: string | null; score: number }>();
  for (const { space, category, topic } of rows) {
    const categoryTitle = category.title.toLocaleLowerCase();
    const topicTitle = topic?.title.toLocaleLowerCase() ?? "";
    const categoryScore = categoryTitle === normalizedKeyword ? 400 : categoryTitle.includes(normalizedKeyword) ? 200 : 0;
    const topicScore = topicTitle === normalizedKeyword ? 500 : topicTitle.includes(normalizedKeyword) ? 300 : 0;
    if (categoryScore && !results.has(`category:${category.id}`)) results.set(`category:${category.id}`, { kind: "category", spaceCode: space.code, categoryId: category.id, categoryTitle: category.title, topicId: null, topicTitle: null, score: categoryScore });
    if (topic && topicScore) results.set(`topic:${topic.id}`, { kind: "topic", spaceCode: space.code, categoryId: category.id, categoryTitle: category.title, topicId: topic.id, topicTitle: topic.title, score: topicScore });
  }
  return [...results.values()].sort((left, right) => right.score - left.score).slice(0, 30);
}
