import { NextResponse } from "next/server";
import { PlaybookServiceError, deleteDocumentTree, getDocument, moveDocumentToTopic, updateDocument } from "@/server/modules/playbook/playbook-service";
import { requireUser } from "@/server/auth";

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext<"/api/hospital-playbook/documents/[id]">) {
  const document = await getDocument(Number((await context.params).id));
  return document ? NextResponse.json(document) : NextResponse.json({ message: "문서를 찾을 수 없습니다." }, { status: 404 });
}

export async function DELETE(_request: Request, context: RouteContext<"/api/hospital-playbook/documents/[id]">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const id = Number((await context.params).id);
  try {
    await deleteDocumentTree(id);
  } catch (error) {
    if (error instanceof PlaybookServiceError) return NextResponse.json({ message: error.message }, { status: error.status });
    throw error;
  }
  return new NextResponse(null, { status: 204 });
}

export async function PATCH(request: Request, context: RouteContext<"/api/hospital-playbook/documents/[id]">) {
  const id = Number((await context.params).id);
  const body = await request.json().catch(() => null) as { title?: unknown; content?: unknown; parentId?: unknown; topicId?: unknown } | null;
  try {
    const parentId = body?.parentId === null || typeof body?.parentId === "number" ? body.parentId : undefined;
    if (typeof body?.topicId === "number") return NextResponse.json(await moveDocumentToTopic(id, body.topicId));
    return NextResponse.json(await updateDocument(id, typeof body?.title === "string" ? body.title : undefined, typeof body?.content === "string" ? body.content : undefined, parentId));
  } catch (error) {
    if (error instanceof PlaybookServiceError) return NextResponse.json({ message: error.message }, { status: error.status });
    throw error;
  }
}
