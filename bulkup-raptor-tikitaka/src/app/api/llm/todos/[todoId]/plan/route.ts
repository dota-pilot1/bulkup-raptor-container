import { handleLlmRequest, LlmPlaybookError } from "@/server/llm-playbook";
import { getTodo, localAgentUserId, TodoError, updateTodo } from "@/server/modules/todo/todo-service";

export const runtime = "nodejs";

function planResponse(todo: NonNullable<Awaited<ReturnType<typeof getTodo>>>) {
  return {
    todoId: todo.id,
    title: todo.title,
    status: todo.status,
    version: todo.version,
    steps: todo.checklist,
  };
}

export async function GET(request: Request, context: RouteContext<"/api/llm/todos/[todoId]/plan">) {
  return handleLlmRequest(request, async () => {
    const todo = await getTodo(await localAgentUserId(), Number((await context.params).todoId));
    if (!todo) throw new LlmPlaybookError(404, "TODO를 찾을 수 없습니다.");
    return planResponse(todo);
  });
}

export async function PATCH(request: Request, context: RouteContext<"/api/llm/todos/[todoId]/plan">) {
  return handleLlmRequest(request, async () => {
    try {
      const body = await request.json().catch(() => ({})) as { steps?: unknown; expectedVersion?: unknown };
      const todo = await updateTodo(await localAgentUserId(), Number((await context.params).todoId), {
        checklist: body.steps,
        expectedVersion: body.expectedVersion,
      }, "AGENT");
      return planResponse(todo);
    } catch (error) {
      if (error instanceof TodoError) throw new LlmPlaybookError(error.status, error.message);
      throw error;
    }
  });
}
