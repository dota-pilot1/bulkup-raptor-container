import { createLlmTopic, handleLlmRequest, LlmPlaybookError } from "@/server/llm-playbook";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/llm/hospital-playbook/categories/[id]/topics">) {
  return handleLlmRequest(request, async () => {
    const body = await request.json().catch(() => null) as { title?: unknown } | null;
    if (typeof body?.title !== "string") throw new LlmPlaybookError(400, "title이 필요합니다.");
    return createLlmTopic(Number((await context.params).id), body.title);
  }, 201);
}
