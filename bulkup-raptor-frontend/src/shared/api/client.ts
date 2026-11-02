export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8090";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  // FormData의 multipart 경계값은 브라우저가 지정한다.
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null) as { code?: string; detail?: string; message?: string; fieldErrors?: Record<string, string> } | null;
    const fieldMessage = error?.fieldErrors ? Object.values(error.fieldErrors).filter(Boolean).join(" ") : "";
    throw new ApiError(fieldMessage || error?.detail || error?.message || `API request failed: ${response.status}`, response.status, error?.code);
  }
  const body = await response.text();
  return (body ? JSON.parse(body) : undefined) as T;
}

