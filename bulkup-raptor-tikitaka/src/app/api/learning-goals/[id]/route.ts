import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { deleteLearningGoal, normalizeGoalInput, updateLearningGoal } from "@/server/learning-goals";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: RouteContext<"/api/learning-goals/[id]">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const id = Number((await context.params).id);
  const input = normalizeGoalInput(await request.json().catch(() => null) ?? {});
  if (!Number.isInteger(id) || id < 1 || !input) return NextResponse.json({ message: "수정할 과제 정보를 확인해 주세요." }, { status: 400 });
  const goal = await updateLearningGoal(user.id, id, input);
  return goal ? NextResponse.json(goal) : NextResponse.json({ message: "과제를 찾을 수 없습니다." }, { status: 404 });
}

export async function DELETE(_request: Request, context: RouteContext<"/api/learning-goals/[id]">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ message: "과제 ID를 확인해 주세요." }, { status: 400 });
  const goal = await deleteLearningGoal(user.id, id);
  return goal ? new NextResponse(null, { status: 204 }) : NextResponse.json({ message: "과제를 찾을 수 없습니다." }, { status: 404 });
}
