import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  return user ? NextResponse.json({ user }) : NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });
}
