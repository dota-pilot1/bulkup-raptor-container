import { handleLlmRequest, LlmPlaybookError, reorderLlmDocuments } from "@/server/llm-playbook";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/llm/hospital-playbook/topics/[topicId]/documents/reorder">) {
  return handleLlmRequest(request, async () => {
    const body = await request.json().catch(() => null) as { ids?: unknown; parentId?: unknown } | null;
    if (!Array.isArray(body?.ids) || !body.ids.every((id) => typeof id === "number")) throw new LlmPlaybookError(400, "ids가 필요합니다.");
    const parentId = typeof body.parentId === "number" ? body.parentId : null;
    await reorderLlmDocuments(Number((await context.params).topicId), body.ids as number[], parentId);
  }, 204);
}
