import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { deleteComment, PlaybookServiceError, updateComment } from "@/server/modules/playbook/playbook-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: RouteContext<"/api/hospital-playbook/comments/[id]">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const id = Number((await context.params).id);
  const body = await request.json().catch(() => null) as { title?: unknown; content?: unknown } | null;
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ message: "댓글 내용이 필요합니다." }, { status: 400 });
  try {
    return NextResponse.json(await updateComment(id, typeof body?.title === "string" ? body.title.trim() || null : null, content));
  } catch (error) {
    if (error instanceof PlaybookServiceError) return NextResponse.json({ message: error.message }, { status: error.status });
    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/hospital-playbook/comments/[id]">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  await deleteComment(Number((await context.params).id));
  return new NextResponse(null, { status: 204 });
}
