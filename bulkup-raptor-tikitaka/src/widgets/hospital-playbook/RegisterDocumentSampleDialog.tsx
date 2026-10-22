import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { playbookApi } from "@/features/hospital-playbook/api";
import { ApiError } from "@/shared/api/client";
import { LexicalEditor } from "@/shared/ui/lexical/lexical-editor";
import { useToast } from "@/shared/ui/toast";

type RegisterDocumentSampleDialogProps = {
  documentId: number;
  documentTitle: string;
  onClose: () => void;
};

/** 현재 문서의 최신 본문을 확인한 뒤 별도 샘플 문서로 복사한다. */
export default function RegisterDocumentSampleDialog({ documentId, documentTitle, onClose }: RegisterDocumentSampleDialogProps) {
  const [title, setTitle] = useState(documentTitle);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const source = useQuery({
    queryKey: ["hospital-playbook", "sample-source", documentId],
    queryFn: () => playbookApi.document(documentId),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const samples = useQuery({
    queryKey: ["hospital-playbook", "samples"],
    queryFn: playbookApi.sampleDocuments,
  });
  const filteredSamples = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (samples.data ?? []).filter((sample) =>
      !term || sample.title.toLowerCase().includes(term) || sample.sampleKey.toLowerCase().includes(term),
    );
  }, [samples.data, search]);
  const duplicateTitle = (samples.data ?? []).some((sample) => sample.title.trim().toLowerCase() === title.trim().toLowerCase());

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const register = async () => {
    if (!source.data?.content.trim() || source.isFetching || !title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      // 샘플 키는 사용자에게 입력받지 않고, 문서 ID와 난수로 고유하게 만든다.
      const sampleKey = `DOCUMENT_${documentId}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
      await playbookApi.createSampleDocument(sampleKey, title.trim(), source.data.content);
      await queryClient.invalidateQueries({ queryKey: ["hospital-playbook", "samples"] });
      showToast("현재 본문을 샘플로 등록했습니다.");
      onClose();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "샘플을 등록하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="현재 본문을 샘플로 등록" onMouseDown={() => { if (!saving) onClose(); }} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); if (!saving) onClose(); } }}>
      <section className="flex h-[min(900px,calc(100vh-2rem))] w-[min(1280px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-raised shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-surface-border-soft px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-text-primary">현재 본문을 샘플로 등록</h2>
            <p className="mt-1 text-xs font-semibold text-text-muted">제목과 복사할 본문을 확인하세요. 원본 문서는 바뀌지 않습니다.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="샘플 등록 닫기" className="ui-icon-button size-8"><X className="size-4" /></button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)] lg:overflow-hidden">
          <section className="flex min-h-[420px] min-w-0 flex-col p-5 lg:min-h-0 lg:border-r lg:border-surface-border-soft" aria-label="등록할 샘플">
            <label className="block text-sm font-black text-text-primary" htmlFor="sample-document-title">샘플 제목</label>
            <input ref={titleRef} id="sample-document-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="샘플 제목을 입력하세요" className="ui-input mt-2 h-10 w-full text-sm" />
            {duplicateTitle && <p className="mt-1 text-xs font-semibold text-amber-700">같은 제목의 샘플이 있습니다. 구분되는 제목을 권장합니다.</p>}
            <div className="mb-2 mt-5 flex items-center justify-between gap-2">
              <h3 className="text-sm font-black text-text-primary">복사할 본문</h3>
              {source.data && <span className="text-[11px] font-semibold text-text-muted">원본 v{source.data.version}</span>}
            </div>
            <div className="min-h-[300px] flex-1 overflow-auto rounded-lg border border-surface-border-soft bg-white">
              {source.isFetching ? <div className="grid h-full min-h-[300px] place-items-center text-sm font-semibold text-text-muted"><span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" />최신 본문을 불러오는 중입니다.</span></div>
                : source.isError ? <div role="alert" className="grid h-full min-h-[300px] place-items-center p-4 text-sm font-semibold text-destructive">본문을 불러오지 못했습니다. 다시 열어 주세요.</div>
                : !source.data?.content.trim() ? <div className="grid h-full min-h-[300px] place-items-center text-sm font-semibold text-text-muted">등록할 본문이 없습니다.</div>
                : <LexicalEditor key={`${source.data.id}-${source.data.version}`} initialState={source.data.content} onChange={() => undefined} readOnly minHeight="300px" />}
            </div>
          </section>

          <aside className="flex min-h-[320px] min-w-0 flex-col border-t border-surface-border-soft bg-surface-muted/25 p-5 lg:min-h-0 lg:border-t-0" aria-label="현재 샘플 목록">
            <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-black text-text-primary">현재 샘플 목록</h3><span className="text-xs font-semibold text-text-muted">{samples.data?.length ?? 0}개</span></div>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="제목 또는 샘플 키 검색" aria-label="현재 샘플 검색" className="ui-input mt-3 h-9 w-full text-xs" />
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-surface-border-soft bg-surface-raised">
              {samples.isPending ? <p className="p-4 text-xs font-semibold text-text-muted">샘플 목록을 불러오는 중입니다.</p>
                : samples.isError ? <p role="alert" className="p-4 text-xs font-semibold text-destructive">샘플 목록을 불러오지 못했습니다.</p>
                : filteredSamples.length === 0 ? <p className="p-4 text-xs font-semibold text-text-muted">표시할 샘플이 없습니다.</p>
                : filteredSamples.map((sample) => <div key={sample.sampleKey} className="border-b border-surface-border-soft px-4 py-3 last:border-b-0"><p className="text-xs font-black text-text-primary">{sample.title}</p><p className="mt-1 break-all font-mono text-[10px] text-text-muted">{sample.sampleKey}</p></div>)}
            </div>
          </aside>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-surface-border-soft px-5 py-3">
          <div className="min-w-0">{error && <p role="alert" className="text-xs font-bold text-destructive">{error}</p>}</div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={onClose} disabled={saving} className="ui-icon-button h-9 px-4 text-xs font-black">취소</button>
            <button type="button" onClick={() => void register()} disabled={saving || source.isFetching || source.isError || !source.data?.content.trim() || !title.trim()} className="ui-icon-button-brand h-9 px-4 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50">{saving ? "등록 중..." : "샘플 등록"}</button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
