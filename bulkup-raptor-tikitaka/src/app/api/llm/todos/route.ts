import { NextResponse } from "next/server";
import { handleLlmRequest, LlmPlaybookError } from "@/server/llm-playbook";
import { createTodo, listTodos, localAgentUserId, TodoError } from "@/server/modules/todo/todo-service";

export const runtime = "nodejs";

function asLlmError(error: unknown): never {
  if (error instanceof TodoError) throw new LlmPlaybookError(error.status, error.message);
  throw error;
}

export async function GET(request: Request) {
  return handleLlmRequest(request, async () => {
    try {
      const query = new URL(request.url).searchParams;
      return await listTodos(await localAgentUserId(), {
        spaceCode: query.get("spaceCode") ?? undefined,
        categoryId: Number(query.get("categoryId")) || null,
        topicId: Number(query.get("topicId")) || null,
        workstream: query.get("workstream") ?? undefined,
        status: query.get("status") ?? undefined,
        q: query.get("q") ?? undefined,
      });
    } catch (error) {
      return asLlmError(error);
    }
  });
}

export async function POST(request: Request) {
  return handleLlmRequest(request, async () => {
    try {
      return await createTodo(await localAgentUserId(), await request.json().catch(() => ({})), "AGENT");
    } catch (error) {
      return asLlmError(error);
    }
  }, 201);
}
