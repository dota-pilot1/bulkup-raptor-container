import { handleLlmRequest, LlmPlaybookError } from "@/server/llm-playbook";
import { localAgentUserId, todoContext, TodoError } from "@/server/modules/todo/todo-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleLlmRequest(request, async () => {
    const topicId = Number(new URL(request.url).searchParams.get("topicId"));
    if (!Number.isInteger(topicId) || topicId < 1) throw new LlmPlaybookError(400, "topicId가 필요합니다.");
    try {
      return await todoContext(await localAgentUserId(), topicId);
    } catch (error) {
      if (error instanceof TodoError) throw new LlmPlaybookError(error.status, error.message);
      throw error;
    }
  });
}
