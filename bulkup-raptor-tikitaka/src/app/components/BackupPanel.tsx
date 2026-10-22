"use client";

import { useState } from "react";
import { HardDrive } from "lucide-react";

export function BackupPanel() {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function downloadBackup() {
    setDownloading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/backup", { cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message ?? `백업 다운로드에 실패했습니다. (${response.status})`);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      const filename = disposition?.match(/filename="([^"]+)"/)?.[1] ?? "pkt-study-backup.db";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      const size = `${(blob.size / 1024).toFixed(1)} KB`;
      setMessage(`백업 다운로드가 완료되었습니다: ${filename} (${size})`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "백업 다운로드에 실패했습니다.");
    } finally {
      setDownloading(false);
    }
  }

  async function restore(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("backup") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return setMessage("백업 파일을 선택해 주세요.");
    setBusy(true);
    setMessage(null);
    const form = new FormData();
    form.set("file", file);
    try {
      const response = await fetch("/api/backup/restore", { method: "POST", body: form });
      const body = await response.json().catch(() => null) as { message?: string } | null;
      setMessage(body?.message ?? "복구 요청이 완료되지 않았습니다.");
    } catch {
      setMessage("복구 파일 확인 중 연결 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const failed = message?.includes("실패") || message?.includes("오류");
  return <section className="space-y-3">
    <div className="rounded-md border border-surface-border-soft bg-surface-raised px-4 py-4">
      <div className="flex items-start gap-3">
        <HardDrive className="mt-0.5 size-5 shrink-0 text-brand-primary" />
        <div>
          <h2 className="text-[14px] font-black text-text-primary">SQLite 데이터 백업·복구</h2>
          <p className="mt-1 text-[12px] font-semibold leading-5 text-text-secondary">노트, 계정, 권한을 포함한 로컬 학습 데이터를 파일로 보관합니다.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={downloadBackup} disabled={downloading} className="ui-icon-button-brand h-10 px-4 text-[12px] font-black disabled:cursor-not-allowed disabled:opacity-50">
          {downloading ? "백업 생성 중…" : "SQLite 백업 다운로드"}
        </button>
        <form onSubmit={restore} className="flex flex-wrap gap-2">
          <input name="backup" type="file" accept=".db,.sqlite" className="h-10 max-w-full rounded-md border border-surface-border bg-background px-2 py-2 text-[12px] text-text-secondary file:mr-2 file:rounded file:border-0 file:bg-brand-glass file:px-2 file:py-1 file:text-[11px] file:font-bold file:text-brand-primary" />
          <button type="submit" disabled={busy} className="ui-icon-button h-10 px-4 text-[12px] font-bold disabled:cursor-not-allowed disabled:opacity-50">{busy ? "확인 중…" : "복구 파일 확인"}</button>
        </form>
      </div>
    </div>
    <p className="rounded-md border border-surface-border-soft bg-surface-raised px-4 py-3 text-[12px] font-semibold leading-5 text-text-muted">복구는 현재 DB를 즉시 덮지 않고, 앱을 재시작할 때 적용됩니다. 복구 전 현재 데이터를 먼저 백업하세요.</p>
    {message ? <p className={`rounded-md border px-4 py-3 text-[12px] font-semibold ${failed ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-emerald-300/60 bg-emerald-50 text-emerald-900"}`} role="status">{message}</p> : null}
  </section>;
}
