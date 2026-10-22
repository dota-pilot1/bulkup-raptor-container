import { handleLlmRequest, LlmPlaybookError, updateLlmDocument } from "@/server/llm-playbook";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: RouteContext<"/api/llm/hospital-playbook/documents/[id]/content">) {
  return handleLlmRequest(request, async () => {
    const body = await request.json().catch(() => null) as { title?: unknown; content?: unknown; expectedVersion?: unknown; parentId?: unknown } | null;
    if (typeof body?.content !== "string") throw new LlmPlaybookError(400, "content가 필요합니다.");
    const parentId = body.parentId === null || typeof body.parentId === "number" ? body.parentId : undefined;
    return updateLlmDocument(
      Number((await context.params).id),
      typeof body.title === "string" ? body.title : undefined,
      body.content,
      typeof body.expectedVersion === "number" ? body.expectedVersion : undefined,
      parentId,
    );
  });
}
