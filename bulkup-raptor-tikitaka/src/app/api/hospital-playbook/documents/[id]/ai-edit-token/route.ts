import { NextResponse } from "next/server";
import { requireUser } from "@/server/auth";
import { issueAiEditToken, PlaybookServiceError } from "@/server/modules/playbook/playbook-service";

export const runtime = "nodejs";

export async function POST(_request: Request, context: RouteContext<"/api/hospital-playbook/documents/[id]/ai-edit-token">) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });

  const documentId = Number((await context.params).id);
  if (!Number.isInteger(documentId)) return NextResponse.json({ message: "문서 ID가 올바르지 않습니다." }, { status: 400 });

  try {
    return NextResponse.json(await issueAiEditToken(documentId, user.id, user.role.code === "ROLE_ADMIN"));
  } catch (error) {
    if (error instanceof PlaybookServiceError) return NextResponse.json({ message: error.message }, { status: error.status });
    throw error;
  }
}
