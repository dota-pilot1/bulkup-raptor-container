import { NextResponse } from "next/server";
import { listLots } from "@/server/lots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listLots());
}
