import { deleteLlmSample, handleLlmRequest, LlmPlaybookError, llmSample, updateLlmSample } from "@/server/llm-playbook";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/api/llm/hospital-playbook/samples/[sampleKey]">) {
  return handleLlmRequest(request, async () => llmSample((await context.params).sampleKey));
}

export async function DELETE(request: Request, context: RouteContext<"/api/llm/hospital-playbook/samples/[sampleKey]">) {
  return handleLlmRequest(request, async () => deleteLlmSample((await context.params).sampleKey), 204);
}

export async function PATCH(request: Request, context: RouteContext<"/api/llm/hospital-playbook/samples/[sampleKey]">) {
  return handleLlmRequest(request, async () => {
    const body = await request.json().catch(() => null) as { sampleKey?: unknown; title?: unknown; content?: unknown; expectedVersion?: unknown } | null;
    if (typeof body?.sampleKey !== "string" || typeof body.title !== "string" || typeof body.content !== "string") throw new LlmPlaybookError(400, "sampleKey, title, content가 필요합니다.");
    return updateLlmSample((await context.params).sampleKey, body.sampleKey, body.title, body.content, typeof body.expectedVersion === "number" ? body.expectedVersion : undefined);
  });
}
