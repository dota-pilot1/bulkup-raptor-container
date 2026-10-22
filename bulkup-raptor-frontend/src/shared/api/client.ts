export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8090";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null) as { detail?: string; message?: string; fieldErrors?: Record<string, string> } | null;
    const fieldMessage = error?.fieldErrors ? Object.values(error.fieldErrors).filter(Boolean).join(" ") : "";
    throw new Error(fieldMessage || error?.detail || error?.message || `API request failed: ${response.status}`);
  }
  const body = await response.text();
  return (body ? JSON.parse(body) : undefined) as T;
}

