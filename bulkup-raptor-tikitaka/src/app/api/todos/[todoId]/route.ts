import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { deleteTodo, getTodo, TodoError, updateTodo } from "@/server/modules/todo/todo-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof TodoError) return NextResponse.json({ message: error.message }, { status: error.status });
  throw error;
}

export async function GET(_request: Request, context: RouteContext<"/api/todos/[todoId]">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const todo = await getTodo(user.id, Number((await context.params).todoId));
  return todo ? NextResponse.json(todo) : NextResponse.json({ message: "TODO를 찾을 수 없습니다." }, { status: 404 });
}

export async function PATCH(request: Request, context: RouteContext<"/api/todos/[todoId]">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  try {
    return NextResponse.json(await updateTodo(user.id, Number((await context.params).todoId), await request.json().catch(() => ({}))));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/todos/[todoId]">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  try {
    await deleteTodo(user.id, Number((await context.params).todoId));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
