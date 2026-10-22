import { handleLlmRequest, LlmPlaybookError } from "@/server/llm-playbook";
import { getTodo, localAgentUserId, TodoError, updateTodo } from "@/server/modules/todo/todo-service";

export const runtime = "nodejs";

function verificationResponse(todo: NonNullable<Awaited<ReturnType<typeof getTodo>>>) {
  return {
    todoId: todo.id,
    title: todo.title,
    status: todo.status,
    version: todo.version,
    checks: todo.verificationChecks,
  };
}

export async function GET(_request: Request, context: RouteContext<"/api/llm/todos/[todoId]/verification">) {
  return handleLlmRequest(_request, async () => {
    const todo = await getTodo(await localAgentUserId(), Number((await context.params).todoId));
    if (!todo) throw new LlmPlaybookError(404, "TODO를 찾을 수 없습니다.");
    return verificationResponse(todo);
  });
}

export async function PATCH(request: Request, context: RouteContext<"/api/llm/todos/[todoId]/verification">) {
  return handleLlmRequest(request, async () => {
    try {
      const body = await request.json().catch(() => ({})) as { checks?: unknown; expectedVersion?: unknown };
      const todo = await updateTodo(await localAgentUserId(), Number((await context.params).todoId), {
        verificationChecks: body.checks,
        expectedVersion: body.expectedVersion,
      }, "AGENT");
      return verificationResponse(todo);
    } catch (error) {
      if (error instanceof TodoError) throw new LlmPlaybookError(error.status, error.message);
      throw error;
    }
  });
}
