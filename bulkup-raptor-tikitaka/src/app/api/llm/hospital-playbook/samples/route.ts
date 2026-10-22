import { createLlmSample, handleLlmRequest, LlmPlaybookError, llmSamples } from "@/server/llm-playbook";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleLlmRequest(request, llmSamples);
}

export async function POST(request: Request) {
  return handleLlmRequest(request, async () => {
    const body = await request.json().catch(() => null) as { sampleKey?: unknown; title?: unknown; content?: unknown } | null;
    if (typeof body?.sampleKey !== "string" || typeof body.title !== "string") throw new LlmPlaybookError(400, "sampleKey와 title이 필요합니다.");
    if (body.content !== undefined && typeof body.content !== "string") throw new LlmPlaybookError(400, "content는 Lexical JSON 문자열이어야 합니다.");
    return createLlmSample(body.sampleKey, body.title, body.content);
  }, 201);
}
