import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { reorderTopics } from "@/server/modules/playbook/playbook-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/hospital-playbook/categories/[categoryId]/topics/reorder">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const categoryId = Number((await context.params).categoryId);
  const body = await request.json().catch(() => null) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) && body.ids.every((id): id is number => Number.isInteger(id)) ? body.ids : null;
  if (!Number.isInteger(categoryId) || !ids) return NextResponse.json({ message: "정렬 대상이 올바르지 않습니다." }, { status: 400 });
  const ok = await reorderTopics(categoryId, ids);
  return ok ? new NextResponse(null, { status: 204 }) : NextResponse.json({ message: "같은 상위 메뉴의 주제만 정렬할 수 있습니다." }, { status: 400 });
}
