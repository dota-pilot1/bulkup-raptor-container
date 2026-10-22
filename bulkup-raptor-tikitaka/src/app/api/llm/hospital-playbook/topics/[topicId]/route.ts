import { deleteLlmTopic, handleLlmRequest, llmTopic, LlmPlaybookError, moveLlmTopic } from "@/server/llm-playbook";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/api/llm/hospital-playbook/topics/[topicId]">) {
  return handleLlmRequest(request, async () => llmTopic(Number((await context.params).topicId)));
}

export async function PATCH(request: Request, context: RouteContext<"/api/llm/hospital-playbook/topics/[topicId]">) {
  return handleLlmRequest(request, async () => {
    const topicId = Number((await context.params).topicId);
    const body = await request.json().catch(() => null) as { categoryId?: unknown } | null;
    if (typeof body?.categoryId !== "number") throw new LlmPlaybookError(400, "이동할 1차 메뉴 ID가 필요합니다.");
    return moveLlmTopic(topicId, body.categoryId);
  });
}

export async function DELETE(request: Request, context: RouteContext<"/api/llm/hospital-playbook/topics/[topicId]">) {
  return handleLlmRequest(request, async () => deleteLlmTopic(Number((await context.params).topicId)), 204);
}
