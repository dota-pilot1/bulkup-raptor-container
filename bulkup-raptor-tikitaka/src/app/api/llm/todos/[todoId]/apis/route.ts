import { handleLlmRequest, LlmPlaybookError } from "@/server/llm-playbook";
import { getTodo, localAgentUserId, TodoError, updateTodo } from "@/server/modules/todo/todo-service";

export const runtime = "nodejs";

function response(todo: NonNullable<Awaited<ReturnType<typeof getTodo>>>) {
  return { todoId: todo.id, title: todo.title, status: todo.status, version: todo.version, apis: todo.apiSpecs };
}

/** 관련 API는 세부 계획·조건 검증과 별개로 저장한다. */
export async function GET(request: Request, context: RouteContext<"/api/llm/todos/[todoId]/apis">) {
  return handleLlmRequest(request, async () => {
    const todo = await getTodo(await localAgentUserId(), Number((await context.params).todoId));
    if (!todo) throw new LlmPlaybookError(404, "TODO를 찾을 수 없습니다.");
    return response(todo);
  });
}

export async function PATCH(request: Request, context: RouteContext<"/api/llm/todos/[todoId]/apis">) {
  return handleLlmRequest(request, async () => {
    try {
      const body = await request.json().catch(() => ({})) as { apis?: unknown; expectedVersion?: unknown };
      return response(await updateTodo(await localAgentUserId(), Number((await context.params).todoId), { apiSpecs: body.apis, expectedVersion: body.expectedVersion }, "AGENT"));
    } catch (error) {
      if (error instanceof TodoError) throw new LlmPlaybookError(error.status, error.message);
      throw error;
    }
  });
}
