import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { createComment, listComments } from "@/server/modules/playbook/playbook-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const documentId = Number(new URL(request.url).searchParams.get("documentId"));
  const comments = await listComments(documentId);
  return NextResponse.json(comments);
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const body = await request.json().catch(() => null) as { documentId?: unknown; title?: unknown; content?: unknown; parentId?: unknown } | null;
  const documentId = typeof body?.documentId === "number" ? body.documentId : 0;
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!documentId || !content) return NextResponse.json({ message: "댓글 내용이 필요합니다." }, { status: 400 });
  const comment = await createComment({ documentId, title: typeof body?.title === "string" ? body.title.trim() : null, content, parentId: typeof body?.parentId === "number" ? body.parentId : null, createdBy: user.id });
  return NextResponse.json(comment, { status: 201 });
}
