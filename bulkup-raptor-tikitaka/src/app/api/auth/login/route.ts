import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { users } from "@/db/schema";
import { db } from "@/server/database";
import { createSession } from "@/server/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user[0] || !user[0].active || !bcrypt.compareSync(password, user[0].passwordHash)) {
    return NextResponse.json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  await createSession(user[0].id);
  return NextResponse.json({ user: await (await import("@/server/auth")).getCurrentUser() });
}
