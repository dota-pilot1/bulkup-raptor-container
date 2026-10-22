import { handleLlmRequest, LlmPlaybookError } from "@/server/llm-playbook";
import { localAgentUserId, reorderTodos, TodoError } from "@/server/modules/todo/todo-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleLlmRequest(request, async () => {
    try {
      const body = await request.json().catch(() => ({})) as {
        ids?: unknown;
        spaceCode?: unknown;
        categoryId?: number | null;
        topicId?: number | null;
        workstream?: unknown;
      };
      if (!Array.isArray(body.ids) || !body.ids.every((id) => Number.isInteger(id))) {
        throw new LlmPlaybookError(400, "재정렬할 TODO ID 목록이 필요합니다.");
      }
      return await reorderTodos(await localAgentUserId(), body.ids, {
        spaceCode: body.spaceCode,
        categoryId: body.categoryId,
        topicId: body.topicId,
        workstream: body.workstream,
      });
    } catch (error) {
      if (error instanceof TodoError) throw new LlmPlaybookError(error.status, error.message);
      throw error;
    }
  });
}
