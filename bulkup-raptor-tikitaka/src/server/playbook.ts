import "server-only";

import { asc, eq } from "drizzle-orm";
import { playbookCategories, playbookDocuments, playbookSpaces, playbookTopics } from "@/db/schema";
import { db } from "@/server/database";

export async function listSpaces() {
  return db.select().from(playbookSpaces).orderBy(asc(playbookSpaces.id));
}

export async function getTree(spaceCode: string) {
  const spaces = await db.select().from(playbookSpaces).where(eq(playbookSpaces.code, spaceCode)).limit(1);
  if (!spaces[0]) return null;
  const categories = await db.select().from(playbookCategories).where(eq(playbookCategories.spaceId, spaces[0].id)).orderBy(asc(playbookCategories.orderIdx));
  const topics = await db.select().from(playbookTopics).orderBy(asc(playbookTopics.orderIdx));
  const documents = await db.select().from(playbookDocuments).orderBy(asc(playbookDocuments.orderIdx));
  return { ...spaces[0], categories: categories.map((category) => ({ ...category, topics: topics.filter((topic) => topic.categoryId === category.id).map((topic) => ({ ...topic, documents: documents.filter((document) => document.topicId === topic.id) })) })) };
}

export async function getDocument(id: number) {
  const result = await db.select().from(playbookDocuments).where(eq(playbookDocuments.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createTopic(categoryId: number, title: string) {
  const category = await db.select().from(playbookCategories).where(eq(playbookCategories.id, categoryId)).limit(1);
  if (!category[0]) return null;
  const topics = await db.select().from(playbookTopics).where(eq(playbookTopics.categoryId, categoryId));
  const now = new Date().toISOString();
  const [topic] = await db.insert(playbookTopics).values({
    categoryId,
    title,
    orderIdx: topics.length,
    createdAt: now,
    updatedAt: now,
  }).returning();
  return topic;
}

export async function renameCategory(id: number, title: string) {
  const [category] = await db.update(playbookCategories)
    .set({ title, updatedAt: new Date().toISOString() })
    .where(eq(playbookCategories.id, id))
    .returning();
  return category ?? null;
}

export async function renameTopic(id: number, title: string) {
  const [topic] = await db.update(playbookTopics)
    .set({ title, updatedAt: new Date().toISOString() })
    .where(eq(playbookTopics.id, id))
    .returning();
  return topic ?? null;
}

export async function deleteTopic(id: number) {
  const [topic] = await db.select().from(playbookTopics).where(eq(playbookTopics.id, id)).limit(1);
  if (!topic) return false;
  await db.delete(playbookTopics).where(eq(playbookTopics.id, id));
  return true;
}

export async function reorderTopics(categoryId: number, ids: number[]) {
  const topics = await db.select().from(playbookTopics).where(eq(playbookTopics.categoryId, categoryId));
  const topicIds = new Set(topics.map((topic) => topic.id));
  if (ids.length !== topics.length || ids.some((id) => !topicIds.has(id))) return false;
  const now = new Date().toISOString();
  for (const [index, id] of ids.entries()) {
    await db.update(playbookTopics).set({ orderIdx: index, updatedAt: now }).where(eq(playbookTopics.id, id));
  }
  return true;
}
