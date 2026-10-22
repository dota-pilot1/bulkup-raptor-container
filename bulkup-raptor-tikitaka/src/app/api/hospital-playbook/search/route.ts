import { NextResponse } from "next/server";
import { searchDocuments, searchMenuEntries } from "@/server/modules/playbook/playbook-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const keyword = (params.get("q") ?? "").trim();
  const spaceCode = params.get("spaceCode");
  const scope = params.get("scope");
  if (!keyword) return NextResponse.json([]);

  if (scope === "menu") return NextResponse.json(await searchMenuEntries(keyword));
  return NextResponse.json(await searchDocuments(keyword, spaceCode));
}
