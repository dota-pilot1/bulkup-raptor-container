import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { reorderTodos, TodoError } from "@/server/modules/todo/todo-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({})) as {
      ids?: unknown;
      spaceCode?: unknown;
      categoryId?: number | null;
      topicId?: number | null;
      workstream?: unknown;
    };
    if (!Array.isArray(body.ids) || !body.ids.every((id) => Number.isInteger(id))) {
      return NextResponse.json({ message: "재정렬할 TODO ID 목록이 필요합니다." }, { status: 400 });
    }
    return NextResponse.json(await reorderTodos(user.id, body.ids, {
      spaceCode: body.spaceCode,
      categoryId: body.categoryId,
      topicId: body.topicId,
      workstream: body.workstream,
    }));
  } catch (error) {
    if (error instanceof TodoError) return NextResponse.json({ message: error.message }, { status: error.status });
    throw error;
  }
}
