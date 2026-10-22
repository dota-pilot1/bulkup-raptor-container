import { handleLlmRequest, llmTree } from "@/server/llm-playbook";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const spaceCode = new URL(request.url).searchParams.get("spaceCode") ?? "PKT_FRONT_LEV1";
  return handleLlmRequest(request, () => llmTree(spaceCode));
}
