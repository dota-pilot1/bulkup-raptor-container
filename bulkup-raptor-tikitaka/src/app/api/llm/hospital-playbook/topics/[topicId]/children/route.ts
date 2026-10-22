import { createLlmDocument, handleLlmRequest, LlmPlaybookError } from "@/server/llm-playbook";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/llm/hospital-playbook/topics/[topicId]/children">) {
  return handleLlmRequest(request, async () => {
    const body = await request.json().catch(() => null) as { title?: unknown; content?: unknown; parentId?: unknown } | null;
    if (typeof body?.title !== "string" || typeof body.content !== "string" || typeof body.parentId !== "number") {
      throw new LlmPlaybookError(400, "title, content, parentId가 필요합니다.");
    }
    return createLlmDocument(Number((await context.params).topicId), body.title, body.content, body.parentId);
  }, 201);
}
