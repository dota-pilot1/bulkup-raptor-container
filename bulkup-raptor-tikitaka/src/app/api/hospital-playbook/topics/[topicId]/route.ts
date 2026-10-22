import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { deleteTopic, moveTopic, PlaybookServiceError, renameTopic } from "@/server/modules/playbook/playbook-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: RouteContext<"/api/hospital-playbook/topics/[topicId]">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const id = Number((await context.params).topicId);
  const body = await request.json().catch(() => null) as { title?: unknown; categoryId?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 300) : "";
  const categoryId = typeof body?.categoryId === "number" ? body.categoryId : null;
  if (!Number.isInteger(id) || (!title && !Number.isInteger(categoryId))) return NextResponse.json({ message: "주제 이름 또는 이동할 1차 메뉴가 필요합니다." }, { status: 400 });
  try {
    let topic = Number.isInteger(categoryId) ? await moveTopic(id, categoryId!) : null;
    if (title) topic = await renameTopic(id, title);
    return topic ? NextResponse.json(topic) : NextResponse.json({ message: "주제를 찾을 수 없습니다." }, { status: 404 });
  } catch (error) {
    if (error instanceof PlaybookServiceError) return NextResponse.json({ message: error.message }, { status: error.status });
    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/hospital-playbook/topics/[topicId]">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const id = Number((await context.params).topicId);
  if (!Number.isInteger(id)) return NextResponse.json({ message: "주제 ID가 올바르지 않습니다." }, { status: 400 });
  try {
    const deleted = await deleteTopic(id);
    return deleted ? new NextResponse(null, { status: 204 }) : NextResponse.json({ message: "주제를 찾을 수 없습니다." }, { status: 404 });
  } catch (error) {
    if (error instanceof PlaybookServiceError) return NextResponse.json({ message: error.message }, { status: error.status });
    throw error;
  }
}
