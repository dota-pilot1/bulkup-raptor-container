import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { deleteCategory, PlaybookServiceError, renameCategory } from "@/server/modules/playbook/playbook-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: RouteContext<"/api/hospital-playbook/categories/[categoryId]">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const id = Number((await context.params).categoryId);
  const body = await request.json().catch(() => null) as { title?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 300) : "";
  if (!Number.isInteger(id) || !title) return NextResponse.json({ message: "메뉴 이름이 필요합니다." }, { status: 400 });
  const category = await renameCategory(id, title);
  return category ? NextResponse.json(category) : NextResponse.json({ message: "메뉴를 찾을 수 없습니다." }, { status: 404 });
}

export async function DELETE(_request: Request, context: RouteContext<"/api/hospital-playbook/categories/[categoryId]">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
  const id = Number((await context.params).categoryId);
  if (!Number.isInteger(id)) return NextResponse.json({ message: "영역 ID가 올바르지 않습니다." }, { status: 400 });
  try {
    const deleted = await deleteCategory(id);
    return deleted ? new NextResponse(null, { status: 204 }) : NextResponse.json({ message: "영역을 찾을 수 없습니다." }, { status: 404 });
  } catch (error) {
    if (error instanceof PlaybookServiceError) return NextResponse.json({ message: error.message }, { status: error.status });
    throw error;
  }
}
