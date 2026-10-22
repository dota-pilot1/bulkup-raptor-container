import { NextResponse } from "next/server";
import { getDatabaseStatus } from "@/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const database = getDatabaseStatus();
  return NextResponse.json({ status: "ok", database });
}
