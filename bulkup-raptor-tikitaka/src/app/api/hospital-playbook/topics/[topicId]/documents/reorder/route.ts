import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { reorderDocuments } from "@/server/modules/playbook/playbook-service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: RouteContext<"/api/hospital-playbook/topics/[topicId]/documents/reorder">,
) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  }

  const topicId = Number((await context.params).topicId);
  const body = (await request.json().catch(() => null)) as {
    ids?: unknown;
    parentId?: unknown;
  } | null;
  const ids = Array.isArray(body?.ids) && body.ids.every((id): id is number => Number.isInteger(id))
    ? body.ids
    : null;
  const parentId = body?.parentId === null || typeof body?.parentId === "number"
    ? body.parentId
    : null;

  if (!Number.isInteger(topicId) || !ids) {
    return NextResponse.json({ message: "정렬 대상이 올바르지 않습니다." }, { status: 400 });
  }

  const reordered = await reorderDocuments(topicId, ids, parentId);
  return reordered
    ? new NextResponse(null, { status: 204 })
    : NextResponse.json(
        { message: "같은 상위 문서의 전체 목록만 정렬할 수 있습니다." },
        { status: 400 },
      );
}
