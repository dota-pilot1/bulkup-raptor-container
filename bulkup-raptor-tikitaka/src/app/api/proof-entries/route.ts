import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { proofEntries } from "@/db/schema";
import { db } from "@/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const entries = await db.select().from(proofEntries).orderBy(desc(proofEntries.id)).limit(10);
  return NextResponse.json(entries);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!message) {
    return NextResponse.json({ message: "메시지를 입력해 주세요." }, { status: 400 });
  }

  const [entry] = await db.insert(proofEntries).values({
    message: message.slice(0, 500),
    createdAt: new Date().toISOString(),
  }).returning();

  return NextResponse.json(entry, { status: 201 });
}
