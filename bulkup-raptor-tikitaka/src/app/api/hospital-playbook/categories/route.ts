import { NextResponse } from "next/server";
import { createCategory } from "@/server/modules/playbook/playbook-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const spaceCode = new URL(request.url).searchParams.get("spaceCode")?.trim().toUpperCase() ?? "";
  const body = await request.json().catch(() => null) as { title?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 300) : "";
  if (!spaceCode || !title) return NextResponse.json({ message: "공간 코드와 영역 이름이 필요합니다." }, { status: 400 });

  const category = await createCategory(spaceCode, title);
  return category
    ? NextResponse.json(category, { status: 201 })
    : NextResponse.json({ message: "플레이북을 찾을 수 없습니다." }, { status: 404 });
}
