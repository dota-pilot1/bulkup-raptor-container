"use client";

import { FormEvent, useState } from "react";

type ProofEntry = { id: number; message: string; createdAt: string };

export function ProofEntryPanel({ initialEntries }: { initialEntries: ProofEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/proof-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const body = await response.json().catch(() => null) as ProofEntry | { message?: string } | null;
      if (!response.ok || !body || !("id" in body)) {
        throw new Error(body && "message" in body && body.message ? body.message : "저장 요청에 실패했습니다.");
      }
      setEntries((current) => [body, ...current].slice(0, 10));
      setMessage("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "저장 요청에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2>영속성 확인</h2>
      <form onSubmit={submit}>
        <label htmlFor="message">테스트 메시지</label>
        <div className="form-row">
          <input id="message" name="message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} placeholder="앱을 재시작해도 남아야 합니다." required />
          <button type="submit" disabled={saving}>{saving ? "저장 중…" : "SQLite에 저장"}</button>
        </div>
      </form>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <ul>
        {entries.length === 0 ? <li>아직 저장한 메시지가 없습니다.</li> : entries.map((entry) => (
          <li key={entry.id}><strong>#{entry.id}</strong> {entry.message}<time>{entry.createdAt}</time></li>
        ))}
      </ul>
    </section>
  );
}
