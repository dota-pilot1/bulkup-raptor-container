import { NextResponse } from "next/server";
import { createTopic } from "@/server/modules/playbook/playbook-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/hospital-playbook/categories/[categoryId]/topics">) {
  const categoryId = Number((await context.params).categoryId);
  const body = await request.json().catch(() => null) as { title?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 300) : "";
  if (!Number.isInteger(categoryId) || !title) return NextResponse.json({ message: "주제 이름이 필요합니다." }, { status: 400 });
  const topic = await createTopic(categoryId, title);
  return topic ? NextResponse.json(topic, { status: 201 }) : NextResponse.json({ message: "상위 메뉴를 찾을 수 없습니다." }, { status: 404 });
}
