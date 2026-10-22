import { NextResponse } from "next/server";
import { createDocument } from "@/server/modules/playbook/playbook-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/hospital-playbook/topics/[topicId]/documents">) {
  const topicId = Number((await context.params).topicId);
  const body = await request.json().catch(() => null) as { title?: unknown; parentId?: unknown; content?: unknown } | null;
  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim().slice(0, 300) : "새 문서";
  const content = typeof body?.content === "string" ? body.content : undefined;
  // 로컬 학습 노트는 로그인 없이도 초안을 만들 수 있으며 작성자는 비워 둔다.
  const document = await createDocument(topicId, title, typeof body?.parentId === "number" ? body.parentId : null, null, content);
  return NextResponse.json(document, { status: 201 });
}
