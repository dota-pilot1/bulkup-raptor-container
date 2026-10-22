import type { MemberSession } from "@/entities/session";
import { apiFetch } from "@/shared/api/client";
import type { LoginForm } from "../model/login-schema";

export function login(payload: LoginForm) {
  return apiFetch<MemberSession>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
