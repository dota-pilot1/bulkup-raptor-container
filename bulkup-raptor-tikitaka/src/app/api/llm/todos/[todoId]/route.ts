import { handleLlmRequest, LlmPlaybookError } from "@/server/llm-playbook";
import { getTodo, localAgentUserId, TodoError, updateTodo } from "@/server/modules/todo/todo-service";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/api/llm/todos/[todoId]">) {
  return handleLlmRequest(request, async () => {
    const todo = await getTodo(await localAgentUserId(), Number((await context.params).todoId));
    if (!todo) throw new LlmPlaybookError(404, "TODO를 찾을 수 없습니다.");
    return todo;
  });
}

export async function PATCH(request: Request, context: RouteContext<"/api/llm/todos/[todoId]">) {
  return handleLlmRequest(request, async () => {
    try {
      return await updateTodo(await localAgentUserId(), Number((await context.params).todoId), await request.json().catch(() => ({})), "AGENT");
    } catch (error) {
      if (error instanceof TodoError) throw new LlmPlaybookError(error.status, error.message);
      throw error;
    }
  });
}
