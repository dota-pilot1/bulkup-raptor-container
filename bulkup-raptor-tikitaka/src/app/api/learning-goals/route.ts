import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { createLearningGoal, deleteAllLearningGoals, listLearningGoals, normalizeGoalInput } from "@/server/learning-goals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  return NextResponse.json(await listLearningGoals(user.id));
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const input = normalizeGoalInput(await request.json().catch(() => null) ?? {});
  if (!input) return NextResponse.json({ message: "분류, 과제명, 핵심 스킬을 입력해 주세요." }, { status: 400 });
  return NextResponse.json(await createLearningGoal(user.id, input), { status: 201 });
}

export async function DELETE() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  await deleteAllLearningGoals(user.id);
  return new NextResponse(null, { status: 204 });
}
