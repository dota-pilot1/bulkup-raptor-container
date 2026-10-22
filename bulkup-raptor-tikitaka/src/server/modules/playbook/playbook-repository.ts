import "server-only";

import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import {
  playbookDocumentComments,
  playbookDocuments,
  playbookCategories,
  playbookSpaces,
  playbookSampleTombstones,
  playbookTopics,
} from "@/db/schema";
import { db } from "@/server/database";

const emptyLexicalState = JSON.stringify({
  root: { children: [], direction: null, format: "", indent: 0, type: "root", version: 1 },
});

type LexicalNode = {
  type?: string;
  text?: string;
  children?: LexicalNode[];
};

/** 빈 root나 빈 문단은 제외하고, 실제로 작성된 본문만 목록 상태로 노출한다. */
function hasDocumentContent(content: string) {
  try {
    const state = JSON.parse(content) as { root?: LexicalNode };
    const visit = (node: LexicalNode): boolean => {
      if (node.text?.trim()) return true;
      if (node.children?.some(visit)) return true;
      return Boolean(
        node.type &&
          !["root", "paragraph", "heading", "quote", "list", "listitem", "code", "text", "linebreak"].includes(node.type),
      );
    };
    return visit(state.root ?? {});
  } catch {
    return content.trim().length > 0;
  }
}

export async function findDocument(id: number) {
  const [document] = await db.select().from(playbookDocuments).where(eq(playbookDocuments.id, id)).limit(1);
  return document ?? null;
}

export async function listSpaces() {
  return db.select().from(playbookSpaces).orderBy(asc(playbookSpaces.id));
}

export async function findSpaceByCode(code: string) {
  const [space] = await db.select().from(playbookSpaces).where(eq(playbookSpaces.code, code)).limit(1);
  return space ?? null;
}

export async function findSpaceById(id: number) {
  const [space] = await db.select().from(playbookSpaces).where(eq(playbookSpaces.id, id)).limit(1);
  return space ?? null;
}

export async function findCategoryById(id: number) {
  const [category] = await db.select().from(playbookCategories).where(eq(playbookCategories.id, id)).limit(1);
  return category ?? null;
}

export async function findTopicById(id: number) {
  const [topic] = await db.select().from(playbookTopics).where(eq(playbookTopics.id, id)).limit(1);
  return topic ?? null;
}

export async function listCategoriesBySpace(spaceId: number) {
  return db.select().from(playbookCategories).where(eq(playbookCategories.spaceId, spaceId)).orderBy(asc(playbookCategories.orderIdx), asc(playbookCategories.id));
}

export async function listAllTopics() {
  return db.select().from(playbookTopics).orderBy(asc(playbookTopics.orderIdx), asc(playbookTopics.id));
}

export async function listAllDocuments() {
  return db.select().from(playbookDocuments).orderBy(asc(playbookDocuments.orderIdx), asc(playbookDocuments.id));
}

export async function listDocumentsByTopic(topicId: number) {
  return db.select().from(playbookDocuments).where(eq(playbookDocuments.topicId, topicId)).orderBy(asc(playbookDocuments.orderIdx), asc(playbookDocuments.id));
}

export async function countCategoriesBySpace(spaceId: number) {
  return (await db.select().from(playbookCategories).where(eq(playbookCategories.spaceId, spaceId))).length;
}

export async function insertCategory(spaceId: number, title: string, orderIdx: number) {
  const now = new Date().toISOString();
  const [category] = await db.insert(playbookCategories).values({ spaceId, title, orderIdx, createdAt: now, updatedAt: now }).returning();
  return category;
}

export async function insertTopic(categoryId: number, title: string, orderIdx: number) {
  const now = new Date().toISOString();
  const [topic] = await db.insert(playbookTopics).values({ categoryId, title, orderIdx, createdAt: now, updatedAt: now }).returning();
  return topic;
}

export async function findParentDocument(id: number, topicId: number) {
  const [parent] = await db.select().from(playbookDocuments).where(and(eq(playbookDocuments.id, id), eq(playbookDocuments.topicId, topicId))).limit(1);
  return parent ?? null;
}

export async function countDocumentsByTopic(topicId: number) {
  return db.select().from(playbookDocuments).where(eq(playbookDocuments.topicId, topicId));
}

export async function updateDocumentOrder(id: number, orderIdx: number, updatedAt: string) {
  await db.update(playbookDocuments).set({ orderIdx, updatedAt }).where(eq(playbookDocuments.id, id));
}

export async function listSampleDocuments() {
  return db.select().from(playbookDocuments).where(isNotNull(playbookDocuments.sampleKey)).orderBy(asc(playbookDocuments.sampleKey));
}

export async function findSampleDocument(sampleKey: string) {
  const [document] = await db.select().from(playbookDocuments).where(eq(playbookDocuments.sampleKey, sampleKey)).limit(1);
  return document ?? null;
}

export async function createSampleDocument(sampleKey: string, title: string, content: string) {
  const space = await findSpaceByCode("NOTE_SAMPLE");
  if (!space) throw new Error("샘플 노트 공간을 찾을 수 없습니다.");
  const categories = await listCategoriesBySpace(space.id);
  const category = categories.find((item) => item.title === "구현 노트 모범 예시")
    ?? await insertCategory(space.id, "구현 노트 모범 예시", categories.length);
  const topic = await insertTopic(category.id, title, (await listAllTopics()).filter((item) => item.categoryId === category.id).length);
  const now = new Date().toISOString();
  const [document] = await db.insert(playbookDocuments).values({
    topicId: topic.id, title, content, orderIdx: 0, sampleKey, createdAt: now, updatedAt: now,
  }).returning();
  await db.delete(playbookSampleTombstones).where(eq(playbookSampleTombstones.sampleKey, sampleKey));
  return document;
}

export async function updateSampleDocument(id: number, patch: { sampleKey: string; title: string; content: string; version: number }) {
  const [document] = await db.update(playbookDocuments)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(playbookDocuments.id, id))
    .returning();
  return document ?? null;
}

export async function addSampleTombstone(sampleKey: string) {
  await db.insert(playbookSampleTombstones).values({ sampleKey, deletedAt: new Date().toISOString() })
    .onConflictDoUpdate({ target: playbookSampleTombstones.sampleKey, set: { deletedAt: new Date().toISOString() } });
}

export async function getTree(spaceCode: string) {
  const [space] = await db.select().from(playbookSpaces).where(eq(playbookSpaces.code, spaceCode)).limit(1);
  if (!space) return null;
  const categories = await db.select().from(playbookCategories).where(eq(playbookCategories.spaceId, space.id)).orderBy(asc(playbookCategories.orderIdx));
  const topics = await db.select().from(playbookTopics).orderBy(asc(playbookTopics.orderIdx));
  const documents = await db.select().from(playbookDocuments).orderBy(asc(playbookDocuments.orderIdx));
  return {
    ...space,
    categories: categories.map((category) => ({
      ...category,
      topics: topics.filter((topic) => topic.categoryId === category.id).map((topic) => ({
        ...topic,
        documents: documents
          .filter((document) => document.topicId === topic.id)
          .map(({ content, ...document }) => ({
            ...document,
            hasContent: hasDocumentContent(content),
          })),
      })),
    })),
  };
}

export async function createTopic(categoryId: number, title: string) {
  const [category] = await db.select().from(playbookCategories).where(eq(playbookCategories.id, categoryId)).limit(1);
  if (!category) return null;
  const topics = await db.select().from(playbookTopics).where(eq(playbookTopics.categoryId, categoryId));
  const now = new Date().toISOString();
  const [topic] = await db.insert(playbookTopics).values({ categoryId, title, orderIdx: topics.length, createdAt: now, updatedAt: now }).returning();
  return topic;
}

export async function createCategory(spaceCode: string, title: string) {
  const [space] = await db.select().from(playbookSpaces).where(eq(playbookSpaces.code, spaceCode)).limit(1);
  if (!space) return null;
  const categories = await listCategoriesBySpace(space.id);
  return insertCategory(space.id, title, categories.length);
}

export async function renameCategory(id: number, title: string) {
  const [category] = await db.update(playbookCategories).set({ title, updatedAt: new Date().toISOString() }).where(eq(playbookCategories.id, id)).returning();
  return category ?? null;
}

export async function renameTopic(id: number, title: string) {
  const [topic] = await db.update(playbookTopics).set({ title, updatedAt: new Date().toISOString() }).where(eq(playbookTopics.id, id)).returning();
  return topic ?? null;
}

export async function moveTopic(id: number, targetCategoryId: number) {
  const topic = await findTopicById(id);
  if (!topic) return null;

  const allTopics = await listAllTopics();
  const sourceTopics = allTopics.filter((item) => item.categoryId === topic.categoryId && item.id !== id);
  const targetTopics = allTopics.filter((item) => item.categoryId === targetCategoryId);
  const now = new Date().toISOString();

  db.transaction((tx) => {
    tx.update(playbookTopics)
      .set({ categoryId: targetCategoryId, orderIdx: targetTopics.length, updatedAt: now })
      .where(eq(playbookTopics.id, id))
      .run();
    for (const [orderIdx, sourceTopic] of sourceTopics.entries()) {
      tx.update(playbookTopics)
        .set({ orderIdx, updatedAt: now })
        .where(eq(playbookTopics.id, sourceTopic.id))
        .run();
    }
  });

  return findTopicById(id);
}

/** 선택 문서와 하위 문서를 다른 2차 주제로 옮긴다. 이동 문서는 새 주제의 루트 문서가 된다. */
export async function moveDocumentToTopic(id: number, targetTopicId: number) {
  const document = await findDocument(id);
  if (!document) return null;
  const treeIds = await findDocumentTreeIds(id);
  if (!treeIds) return null;

  const sourceDocuments = await listDocumentsByTopic(document.topicId);
  const targetDocuments = await listDocumentsByTopic(targetTopicId);
  const movingIds = new Set(treeIds);
  const remainingSource = sourceDocuments.filter((item) => !movingIds.has(item.id));
  const targetRootCount = targetDocuments.filter((item) => item.parentId === null).length;
  const now = new Date().toISOString();

  db.transaction((tx) => {
    for (const documentId of treeIds) {
      tx.update(playbookDocuments)
        .set({
          topicId: targetTopicId,
          ...(documentId === id ? { parentId: null, orderIdx: targetRootCount } : {}),
          updatedAt: now,
        })
        .where(eq(playbookDocuments.id, documentId))
        .run();
    }

    const sourceOrderByParent = new Map<number | null, number>();
    for (const sourceDocument of remainingSource) {
      const orderIdx = sourceOrderByParent.get(sourceDocument.parentId) ?? 0;
      sourceOrderByParent.set(sourceDocument.parentId, orderIdx + 1);
      tx.update(playbookDocuments)
        .set({ orderIdx, updatedAt: now })
        .where(eq(playbookDocuments.id, sourceDocument.id))
        .run();
    }
  });

  return findDocument(id);
}

export async function deleteTopic(id: number) {
  const [topic] = await db.select().from(playbookTopics).where(eq(playbookTopics.id, id)).limit(1);
  if (!topic) return false;
  const documents = await db.select({ id: playbookDocuments.id })
    .from(playbookDocuments)
    .where(eq(playbookDocuments.topicId, id));

  // 문서와 댓글이 topic/category를 참조하므로, 하위 레코드부터 삭제한다.
  db.transaction((tx) => {
    const documentIds = documents.map((document) => document.id);
    if (documentIds.length > 0) {
      tx.delete(playbookDocumentComments).where(inArray(playbookDocumentComments.documentId, documentIds)).run();
      tx.delete(playbookDocuments).where(inArray(playbookDocuments.id, documentIds)).run();
    }
    tx.delete(playbookTopics).where(eq(playbookTopics.id, id)).run();
  });
  return true;
}

export async function deleteCategory(id: number) {
  const [category] = await db.select().from(playbookCategories).where(eq(playbookCategories.id, id)).limit(1);
  if (!category) return false;
  const topics = await db.select({ id: playbookTopics.id })
    .from(playbookTopics)
    .where(eq(playbookTopics.categoryId, id));
  const topicIds = topics.map((topic) => topic.id);
  const documents = topicIds.length > 0
    ? await db.select({ id: playbookDocuments.id })
      .from(playbookDocuments)
      .where(inArray(playbookDocuments.topicId, topicIds))
    : [];

  // 영역 삭제는 topic -> document/comment -> category 순으로 정리해야 한다.
  db.transaction((tx) => {
    const documentIds = documents.map((document) => document.id);
    if (documentIds.length > 0) {
      tx.delete(playbookDocumentComments).where(inArray(playbookDocumentComments.documentId, documentIds)).run();
      tx.delete(playbookDocuments).where(inArray(playbookDocuments.id, documentIds)).run();
    }
    if (topicIds.length > 0) {
      tx.delete(playbookTopics).where(inArray(playbookTopics.id, topicIds)).run();
    }
    tx.delete(playbookCategories).where(eq(playbookCategories.id, id)).run();
  });
  return true;
}

export async function reorderTopics(categoryId: number, ids: number[]) {
  const topics = await db.select().from(playbookTopics).where(eq(playbookTopics.categoryId, categoryId));
  const topicIds = new Set(topics.map((topic) => topic.id));
  if (ids.length !== topics.length || ids.some((id) => !topicIds.has(id))) return false;
  const now = new Date().toISOString();
  db.transaction((tx) => {
    for (const [index, id] of ids.entries()) {
      tx.update(playbookTopics).set({ orderIdx: index, updatedAt: now }).where(eq(playbookTopics.id, id)).run();
    }
  });
  return true;
}

export async function reorderCategories(ids: number[]) {
  if (ids.length === 0) return false;
  const categories = await db.select().from(playbookCategories).where(inArray(playbookCategories.id, ids));
  if (categories.length !== ids.length) return false;
  const spaceId = categories[0]?.spaceId;
  if (spaceId === undefined || categories.some((category) => category.spaceId !== spaceId)) return false;
  const allCategories = await listCategoriesBySpace(spaceId);
  const categoryIds = new Set(allCategories.map((category) => category.id));
  if (ids.length !== allCategories.length || ids.some((id) => !categoryIds.has(id))) return false;
  const now = new Date().toISOString();
  db.transaction((tx) => {
    for (const [index, id] of ids.entries()) {
      tx.update(playbookCategories).set({ orderIdx: index, updatedAt: now }).where(eq(playbookCategories.id, id)).run();
    }
  });
  return true;
}

export async function reorderDocuments(
  topicId: number,
  ids: number[],
  parentId: number | null,
) {
  const documents = await listDocumentsByTopic(topicId);
  const siblings = documents.filter((document) => document.parentId === parentId);
  const siblingIds = new Set(siblings.map((document) => document.id));
  if (ids.length !== siblings.length || ids.some((id) => !siblingIds.has(id))) {
    return false;
  }

  const now = new Date().toISOString();
  db.transaction((tx) => {
    for (const [orderIdx, id] of ids.entries()) {
      tx.update(playbookDocuments)
        .set({ orderIdx, updatedAt: now })
        .where(eq(playbookDocuments.id, id))
        .run();
    }
  });
  return true;
}

export async function createDocument(topicId: number, title: string, parentId: number | null, createdBy: number | null = null, content = emptyLexicalState, orderIdx = 0) {
  const now = new Date().toISOString();
  const [document] = await db.insert(playbookDocuments).values({
    topicId,
    title,
    parentId,
    content,
    orderIdx,
    createdBy,
    createdAt: now,
    updatedAt: now,
  }).returning();
  return document;
}

export async function updateDocument(id: number, patch: { title?: string; content?: string; parentId?: number | null; orderIdx?: number; version: number }) {
  const [document] = await db.update(playbookDocuments)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(playbookDocuments.id, id))
    .returning();
  return document ?? null;
}

export async function findDocumentTreeIds(id: number) {
  const documents = await db.select({ id: playbookDocuments.id, parentId: playbookDocuments.parentId })
    .from(playbookDocuments);
  if (!documents.some((document) => document.id === id)) return null;

  const ids = new Set<number>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const document of documents) {
      if (document.parentId !== null && ids.has(document.parentId) && !ids.has(document.id)) {
        ids.add(document.id);
        changed = true;
      }
    }
  }
  return [...ids];
}

export async function deleteDocumentTree(ids: number[]) {
  // 하위 문서 삭제 전에 연결된 댓글을 먼저 지워 외래 키 충돌을 방지한다.
  await db.delete(playbookDocumentComments).where(inArray(playbookDocumentComments.documentId, ids));
  await db.delete(playbookDocuments).where(inArray(playbookDocuments.id, ids));
}

export async function listComments(documentId: number) {
  return db.select().from(playbookDocumentComments)
    .where(eq(playbookDocumentComments.documentId, documentId))
    .orderBy(asc(playbookDocumentComments.id));
}

export async function createComment(input: {
  documentId: number;
  title: string | null;
  content: string;
  parentId: number | null;
  createdBy: number;
}) {
  const now = new Date().toISOString();
  const [comment] = await db.insert(playbookDocumentComments).values({
    ...input,
    createdAt: now,
    updatedAt: now,
  }).returning();
  return comment;
}

export async function updateComment(id: number, title: string | null, content: string) {
  const [comment] = await db.update(playbookDocumentComments)
    .set({ title, content, updatedAt: new Date().toISOString() })
    .where(eq(playbookDocumentComments.id, id))
    .returning();
  return comment ?? null;
}

export async function deleteComment(id: number) {
  db.delete(playbookDocumentComments).where(eq(playbookDocumentComments.id, id));
}

export async function issueAiEditToken(id: number, tokenHash: string, expiresAt: string) {
  await db.update(playbookDocuments)
    .set({ aiEditTokenHash: tokenHash, aiEditTokenExpiresAt: expiresAt, aiEditTokenUsedAt: null })
    .where(eq(playbookDocuments.id, id));
}

export async function searchDocuments(keyword: string, spaceCode: string | null) {
  const conditions = spaceCode ? eq(playbookSpaces.code, spaceCode) : undefined;
  return db.select({ document: playbookDocuments, topic: playbookTopics, category: playbookCategories, space: playbookSpaces })
    .from(playbookDocuments)
    .innerJoin(playbookTopics, eq(playbookDocuments.topicId, playbookTopics.id))
    .innerJoin(playbookCategories, eq(playbookTopics.categoryId, playbookCategories.id))
    .innerJoin(playbookSpaces, eq(playbookCategories.spaceId, playbookSpaces.id))
    .where(conditions)
    .orderBy(asc(playbookDocuments.updatedAt));
}

export async function listSearchMenus() {
  return db.select({ space: playbookSpaces, category: playbookCategories, topic: playbookTopics })
    .from(playbookCategories)
    .innerJoin(playbookSpaces, eq(playbookCategories.spaceId, playbookSpaces.id))
    .leftJoin(playbookTopics, eq(playbookTopics.categoryId, playbookCategories.id))
    .orderBy(asc(playbookSpaces.name), asc(playbookCategories.orderIdx), asc(playbookTopics.orderIdx));
}
