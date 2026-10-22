import { NextResponse } from "next/server";
import { getTree, listSpaces } from "@/server/modules/playbook/playbook-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("spaceCode");
  if (!code) return NextResponse.json(await listSpaces());
  const tree = await getTree(code);
  return tree ? NextResponse.json(tree.categories) : NextResponse.json({ message: "플레이북을 찾을 수 없습니다." }, { status: 404 });
}
