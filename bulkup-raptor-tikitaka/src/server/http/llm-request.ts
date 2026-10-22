import "server-only";

import { NextResponse } from "next/server";

export class LlmPlaybookError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function assertLlmApiAccess(request: Request) {
  const hostname = new URL(request.url).hostname;
  const local = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (local || process.env.PLAYBOOK_LLM_API_PUBLIC === "true") return;
  throw new LlmPlaybookError(403, "LLM API 공개 접근이 비활성화되어 있습니다.");
}

export function llmErrorResponse(error: unknown) {
  if (error instanceof LlmPlaybookError) return NextResponse.json({ message: error.message }, { status: error.status });
  throw error;
}

export async function handleLlmRequest(request: Request, operation: () => Promise<unknown>, successStatus = 200) {
  try {
    assertLlmApiAccess(request);
    const result = await operation();
    return successStatus === 204 ? new NextResponse(null, { status: 204 }) : NextResponse.json(result, { status: successStatus });
  } catch (error) {
    return llmErrorResponse(error);
  }
}
