import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { createTodo, listTodos, TodoError } from "@/server/modules/todo/todo-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof TodoError) return NextResponse.json({ message: error.message }, { status: error.status });
  throw error;
}

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  try {
    const query = new URL(request.url).searchParams;
    return NextResponse.json(await listTodos(user.id, {
      spaceCode: query.get("spaceCode") ?? undefined,
      categoryId: Number(query.get("categoryId")) || null,
      topicId: Number(query.get("topicId")) || null,
      workstream: query.get("workstream") ?? undefined,
      status: query.get("status") ?? undefined,
      q: query.get("q") ?? undefined,
    }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  try {
    return NextResponse.json(await createTodo(user.id, await request.json().catch(() => ({}))), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
