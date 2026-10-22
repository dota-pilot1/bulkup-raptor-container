import { createLlmDocument, handleLlmRequest, llmTopicDocumentTree, LlmPlaybookError } from "@/server/llm-playbook";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/api/llm/hospital-playbook/topics/[topicId]/documents">) {
  return handleLlmRequest(request, async () => {
    const topicId = Number((await context.params).topicId);
    return llmTopicDocumentTree(topicId, new URL(request.url).origin);
  });
}

export async function POST(request: Request, context: RouteContext<"/api/llm/hospital-playbook/topics/[topicId]/documents">) {
  return handleLlmRequest(request, async () => {
    const body = await request.json().catch(() => null) as { title?: unknown; content?: unknown; parentId?: unknown } | null;
    if (typeof body?.title !== "string" || typeof body.content !== "string") throw new LlmPlaybookError(400, "title과 content가 필요합니다.");
    const parentId = typeof body.parentId === "number" ? body.parentId : null;
    return createLlmDocument(Number((await context.params).topicId), body.title, body.content, parentId);
  }, 201);
}
