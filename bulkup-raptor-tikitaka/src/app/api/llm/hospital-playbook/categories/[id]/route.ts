import { deleteLlmCategory, handleLlmRequest, llmCategory } from "@/server/llm-playbook";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/api/llm/hospital-playbook/categories/[id]">) {
  return handleLlmRequest(request, async () => llmCategory(Number((await context.params).id)));
}

export async function DELETE(request: Request, context: RouteContext<"/api/llm/hospital-playbook/categories/[id]">) {
  return handleLlmRequest(request, async () => deleteLlmCategory(Number((await context.params).id)), 204);
}
