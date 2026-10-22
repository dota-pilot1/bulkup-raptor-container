import { deleteLlmDocument, handleLlmRequest, llmDocument, LlmPlaybookError, moveLlmDocumentToTopic } from "@/server/llm-playbook";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/api/llm/hospital-playbook/documents/[id]">) {
  return handleLlmRequest(request, async () => llmDocument(Number((await context.params).id)));
}

export async function PATCH(request: Request, context: RouteContext<"/api/llm/hospital-playbook/documents/[id]">) {
  return handleLlmRequest(request, async () => {
    const body = await request.json().catch(() => null) as { topicId?: unknown } | null;
    if (typeof body?.topicId !== "number") throw new LlmPlaybookError(400, "이동할 2차 메뉴 ID가 필요합니다.");
    return moveLlmDocumentToTopic(Number((await context.params).id), body.topicId);
  });
}

export async function DELETE(request: Request, context: RouteContext<"/api/llm/hospital-playbook/documents/[id]">) {
  return handleLlmRequest(request, async () => deleteLlmDocument(Number((await context.params).id)), 204);
}
