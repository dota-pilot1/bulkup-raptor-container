"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { getLoginReturnTo } from "@/shared/lib/auth-return-to";

type User = { email: string; username: string; role: { name: string } };

export function LoginPanel({ user }: { user: User | null }) {
  const [email, setEmail] = useState("terecal@daum.net");
  const [password, setPassword] = useState("password123");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      window.location.replace(getLoginReturnTo(returnTo));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "로그인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      window.location.replace("/login");
    }
  }

  if (user) {
    return <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><span><strong>{user.username}</strong> · {user.role.name} · {user.email}</span><button type="button" onClick={logout} className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-black hover:bg-emerald-100">로그아웃</button></div>;
  }

  return (
    <section>
      <h2 className="text-sm font-black text-slate-800">로컬 인증</h2>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <label className="block text-xs font-bold text-slate-600">
          이메일
          <input className="mt-1.5 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="이메일" required />
        </label>
        <label className="block text-xs font-bold text-slate-600">
          비밀번호
          <div className="relative mt-1.5">
            <input className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호" autoComplete="current-password" required />
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"} className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </label>
        <button type="submit" disabled={busy} className="h-10 w-full rounded-md bg-blue-600 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">{busy ? "로그인 중…" : "로그인"}</button>
      </form>
      {error ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-bold text-red-700" role="alert">{error}</p> : <p className="mt-3 text-xs font-semibold text-slate-500">개발용 기본 계정: terecal@daum.net / password123</p>}
    </section>
  );
}
