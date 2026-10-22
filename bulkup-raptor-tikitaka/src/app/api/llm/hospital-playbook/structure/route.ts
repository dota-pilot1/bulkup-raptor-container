import { createLlmStructure, handleLlmRequest, LlmPlaybookError } from "@/server/llm-playbook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleLlmRequest(request, async () => {
    const body = await request.json().catch(() => null) as { spaceCode?: unknown; categoryTitle?: unknown; topicTitles?: unknown } | null;
    if (typeof body?.spaceCode !== "string" || typeof body.categoryTitle !== "string" || !Array.isArray(body.topicTitles)) {
      throw new LlmPlaybookError(400, "spaceCode, categoryTitle, topicTitles가 필요합니다.");
    }
    const topicTitles = body.topicTitles.filter((title): title is string => typeof title === "string");
    return createLlmStructure(body.spaceCode, body.categoryTitle, topicTitles);
  }, 201);
}
