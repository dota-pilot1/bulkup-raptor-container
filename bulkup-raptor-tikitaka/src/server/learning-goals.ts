import "server-only";

import { and, asc, eq, max } from "drizzle-orm";
import { learningGoals } from "@/db/schema";
import { db } from "@/server/database";

export type LearningGoalInput = { groupName: string; task: string; skill: string; progress?: number };

function now() { return new Date().toISOString(); }

export function normalizeGoalInput(input: Partial<LearningGoalInput>): LearningGoalInput | null {
  const groupName = typeof input.groupName === "string" ? input.groupName.trim().slice(0, 40) : "";
  const task = typeof input.task === "string" ? input.task.trim().slice(0, 160) : "";
  const skill = typeof input.skill === "string" ? input.skill.trim().slice(0, 160) : "";
  if (!groupName || !task || !skill) return null;
  const progress = typeof input.progress === "number" && Number.isFinite(input.progress) ? Math.max(0, Math.min(100, Math.round(input.progress))) : 0;
  return { groupName, task, skill, progress };
}

export async function listLearningGoals(userId: number) {
  return db.select().from(learningGoals).where(eq(learningGoals.userId, userId)).orderBy(asc(learningGoals.orderIdx), asc(learningGoals.id));
}

export async function createLearningGoal(userId: number, input: LearningGoalInput) {
  const latest = await db.select({ orderIdx: max(learningGoals.orderIdx) }).from(learningGoals).where(eq(learningGoals.userId, userId));
  const timestamp = now();
  const progress = input.progress ?? 0;
  const [goal] = await db.insert(learningGoals).values({ ...input, progress, completed: progress === 100, userId, orderIdx: (latest[0]?.orderIdx ?? -1) + 1, createdAt: timestamp, updatedAt: timestamp }).returning();
  return goal;
}

export async function updateLearningGoal(userId: number, id: number, input: LearningGoalInput) {
  const progress = input.progress ?? 0;
  const [goal] = await db.update(learningGoals).set({ ...input, progress, completed: progress === 100, updatedAt: now() }).where(and(eq(learningGoals.id, id), eq(learningGoals.userId, userId))).returning();
  return goal ?? null;
}

export async function deleteLearningGoal(userId: number, id: number) {
  const [goal] = await db.delete(learningGoals).where(and(eq(learningGoals.id, id), eq(learningGoals.userId, userId))).returning();
  return goal ?? null;
}

export async function deleteAllLearningGoals(userId: number) {
  await db.delete(learningGoals).where(eq(learningGoals.userId, userId));
}
