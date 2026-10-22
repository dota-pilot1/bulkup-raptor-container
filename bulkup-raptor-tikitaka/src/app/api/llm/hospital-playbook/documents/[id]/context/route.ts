import { handleLlmRequest, llmDocumentContext } from "@/server/llm-playbook";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/api/llm/hospital-playbook/documents/[id]/context">) {
  return handleLlmRequest(request, async () => llmDocumentContext(Number((await context.params).id)));
}
