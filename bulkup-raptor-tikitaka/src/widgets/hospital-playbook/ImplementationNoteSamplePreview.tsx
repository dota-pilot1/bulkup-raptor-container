import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Eye, Trash2, X } from "lucide-react";
import { LexicalEditor } from "../../shared/ui/lexical/lexical-editor";
import { playbookApi, type PlaybookSampleKey, type PlaybookSampleSummary } from "../../features/hospital-playbook/api";
import { getApiBase } from "../../shared/api/client";
import { copyToClipboard } from "../../shared/lib/clipboard";
import { useToast } from "../../shared/ui/toast";

type ImplementationNoteSamplePreviewProps = {
  minHeight?: string;
  selectedKeys?: PlaybookSampleKey[];
  onSelectedKeysChange?: (keys: PlaybookSampleKey[]) => void;
  showInlinePreview?: boolean;
};

/** DB에 저장된 노트 템플릿을 고르고, 필요한 경우 한 건만 GET으로 상세 확인한다. */
export default function ImplementationNoteSamplePreview({ minHeight = "620px", selectedKeys, onSelectedKeysChange, showInlinePreview = true }: ImplementationNoteSamplePreviewProps) {
  const samples = useQuery({
    queryKey: ["hospital-playbook", "samples"],
    queryFn: playbookApi.sampleDocuments,
  });
  const [previewKey, setPreviewKey] = useState<PlaybookSampleKey | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [localSelectedKeys, setLocalSelectedKeys] = useState<PlaybookSampleKey[]>([]);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sampleKeyDraft, setSampleKeyDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const newTitleRef = useRef<HTMLInputElement>(null);
  const [newKey, setNewKey] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [copiedSampleKey, setCopiedSampleKey] = useState<PlaybookSampleKey | null>(null);
  const [selectedSamplesCopied, setSelectedSamplesCopied] = useState(false);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const activeSelectedKeys = selectedKeys ?? localSelectedKeys;
  const sampleKey = previewKey ?? samples.data?.[0]?.sampleKey ?? null;
  const sample = useQuery({
    queryKey: ["hospital-playbook", "sample", sampleKey],
    queryFn: () => playbookApi.sampleDocument(sampleKey!),
    enabled: sampleKey !== null,
  });

  const save = useMutation({
    mutationFn: () => {
      if (!sample.data) throw new Error("저장할 예제가 없습니다.");
      return playbookApi.updateSampleDocument(sample.data.sampleKey, {
        sampleKey: sampleKeyDraft,
        title: title.trim() || sample.data.title,
        content,
        expectedVersion: sample.data.version,
      });
    },
    onSuccess: async (updated) => {
      setEditing(false);
      setPreviewKey(updated.sampleKey);
      const nextSelected = activeSelectedKeys.map((item) => item === sample.data?.sampleKey ? updated.sampleKey : item);
      if (selectedKeys === undefined) setLocalSelectedKeys(nextSelected);
      onSelectedKeysChange?.(nextSelected);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["hospital-playbook", "samples"] }),
        queryClient.removeQueries({ queryKey: ["hospital-playbook", "sample", sampleKey] }),
        queryClient.invalidateQueries({ queryKey: ["hospital-playbook", "sample", updated.sampleKey] }),
      ]);
    },
  });

  const create = useMutation({
    mutationFn: () => playbookApi.createSampleDocument(newKey.trim(), newTitle.trim(), newContent || undefined),
    onSuccess: async (created) => {
      setAdding(false);
      setNewKey("");
      setNewTitle("");
      setNewContent("");
      setPreviewKey(created.sampleKey);
      await queryClient.invalidateQueries({ queryKey: ["hospital-playbook", "samples"] });
    },
  });

  const remove = useMutation({
    mutationFn: (key: PlaybookSampleKey) => playbookApi.deleteSampleDocument(key),
    onSuccess: async (_, deletedKey) => {
      setEditing(false);
      const nextSelected = activeSelectedKeys.filter((item) => item !== deletedKey);
      if (selectedKeys === undefined) setLocalSelectedKeys(nextSelected);
      onSelectedKeysChange?.(nextSelected);
      if (previewKey === deletedKey) setPreviewKey(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["hospital-playbook", "samples"] }),
        queryClient.removeQueries({ queryKey: ["hospital-playbook", "sample", deletedKey] }),
      ]);
    },
  });

  const editSample = useMutation({
    mutationFn: (key: PlaybookSampleKey) => queryClient.fetchQuery({
      queryKey: ["hospital-playbook", "sample", key],
      queryFn: () => playbookApi.sampleDocument(key),
      staleTime: 0,
    }),
    onSuccess: (document) => {
      save.reset();
      setPreviewKey(document.sampleKey);
      setTitle(document.title);
      setContent(document.content);
      setSampleKeyDraft(document.sampleKey);
      setEditing(true);
      if (!showInlinePreview) setPreviewDialogOpen(true);
    },
    onError: (error) => showToast(error instanceof Error ? error.message : "예제를 불러오지 못했습니다.", "error"),
  });

  const beginEdit = () => {
    if (!sample.data) return;
    setTitle(sample.data.title);
    setContent(sample.data.content);
    setSampleKeyDraft(sample.data.sampleKey);
    save.reset();
    setEditing(true);
  };

  const cancelEdit = () => {
    if (sample.data) {
      setTitle(sample.data.title);
      setContent(sample.data.content);
      setSampleKeyDraft(sample.data.sampleKey);
    }
    setEditing(false);
  };

  const toggle = (key: PlaybookSampleKey) => {
    const next = activeSelectedKeys.includes(key)
      ? activeSelectedKeys.filter((item) => item !== key)
      : [...activeSelectedKeys, key];
    if (selectedKeys === undefined) setLocalSelectedKeys(next);
    onSelectedKeysChange?.(next);
  };

  const preview = (item: PlaybookSampleSummary) => {
    setEditing(false);
    setPreviewKey(item.sampleKey);
    if (!showInlinePreview) setPreviewDialogOpen(true);
  };

  const copySampleApi = async (item: PlaybookSampleSummary) => {
    const endpoint = `${window.location.origin}${getApiBase()}/api/llm/hospital-playbook/samples/${item.sampleKey}`;
    try {
      await copyToClipboard([
        `GET ${endpoint}`,
        "",
        `${item.title} (${item.sampleKey}) 작성 형식을 조회합니다.`,
      ].join("\n"));
      setCopiedSampleKey(item.sampleKey);
      showToast("샘플 조회 URL과 설명을 복사했습니다.");
      window.setTimeout(() => setCopiedSampleKey(null), 1600);
    } catch {
      showToast("클립보드에 복사하지 못했습니다.", "error");
    }
  };

  const sampleItems = samples.data ?? [];
  const allSamplesSelected = sampleItems.length > 0 && sampleItems.every((item) => activeSelectedKeys.includes(item.sampleKey));
  const toggleAllSamples = () => {
    const next = allSamplesSelected ? [] : sampleItems.map((item) => item.sampleKey);
    if (selectedKeys === undefined) setLocalSelectedKeys(next);
    onSelectedKeysChange?.(next);
  };
  const copySelectedSamples = async () => {
    const selectedSamples = sampleItems.filter((item) => activeSelectedKeys.includes(item.sampleKey));
    if (selectedSamples.length === 0) {
      showToast("복사할 샘플을 선택하세요.", "info");
      return;
    }
    const value = selectedSamples.map((item) => [
      `# ${item.title}`,
      `GET ${window.location.origin}${getApiBase()}/api/llm/hospital-playbook/samples/${item.sampleKey}`,
      "",
      `${item.sampleKey} 작성 형식을 조회합니다.`,
    ].join("\n")).join("\n\n---\n\n");
    try {
      await copyToClipboard(value);
      setSelectedSamplesCopied(true);
      showToast("선택한 샘플 API 정보를 복사했습니다.");
      window.setTimeout(() => setSelectedSamplesCopied(false), 1600);
    } catch {
      showToast("클립보드에 복사하지 못했습니다.", "error");
    }
  };

  return (
    <div className="flex min-h-0 flex-col">
      <div className="shrink-0 border-b border-surface-border-soft bg-surface-raised px-4 py-3">
        <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold leading-5 text-text-muted">샘플은 선택하면 지시문에 포함됩니다. 미리 보기에서 본문을 확인하고, 수정에서 제목과 본문을 편집하세요.</p><div className="flex shrink-0 items-center gap-2"><button type="button" onClick={() => void copySelectedSamples()} className="ui-icon-button-brand h-8 gap-1.5 px-2.5 text-[11px] font-black">{selectedSamplesCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}선택 샘플 복사 ({sampleItems.filter((item) => activeSelectedKeys.includes(item.sampleKey)).length})</button><button type="button" onClick={() => { create.reset(); setAdding(true); }} className="ui-icon-button-brand h-8 px-2.5 text-[11px] font-black">+ 예제</button></div></div>

        {samples.isLoading ? <p className="mt-3 text-xs font-bold text-text-muted">예제 목록을 불러오는 중입니다.</p> : samples.isError ? <p role="alert" className="mt-3 text-xs font-bold text-destructive">예제 목록을 불러오지 못했습니다.</p> : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-surface-border-soft">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead className="bg-surface-muted text-text-secondary"><tr><th className="w-12 px-3 py-2.5 text-center font-black"><input type="checkbox" checked={allSamplesSelected} onChange={toggleAllSamples} aria-label="모든 샘플 선택" className="size-4 accent-brand-primary" /></th><th className="px-3 py-2.5 font-black">예제</th><th className="min-w-48 px-3 py-2.5 font-black">조회 URL</th><th className="w-52 px-3 py-2.5 text-center font-black">관리</th></tr></thead>
              <tbody>{samples.data?.map((item) => <tr key={item.sampleKey} onClick={showInlinePreview ? () => preview(item) : undefined} className={`${showInlinePreview ? "cursor-pointer " : ""}border-t border-surface-border-soft transition-colors ${showInlinePreview && sampleKey === item.sampleKey ? "bg-brand-primary/5 hover:bg-brand-primary/10" : "hover:bg-surface-muted/60"}`}>
                <td className="!align-middle px-3 py-3 text-center"><input type="checkbox" checked={activeSelectedKeys.includes(item.sampleKey)} onClick={(event) => event.stopPropagation()} onChange={() => toggle(item.sampleKey)} aria-label={item.title + " 선택"} className="size-4 accent-brand-primary" /></td>
                <td className="px-3 py-3"><p className="font-black text-text-primary">{item.title}</p><p className="mt-1 font-mono text-[10px] text-text-muted">{item.sampleKey}</p></td>
                <td className="!align-middle break-all px-3 py-3 font-mono text-[10px] leading-4 text-text-muted">GET /api/llm/hospital-playbook/samples/{item.sampleKey}</td>
                <td className="!align-middle px-3 py-3 text-center">
                  <div className="flex justify-center gap-1">
                    <button type="button" onClick={(event) => { event.stopPropagation(); void copySampleApi(item); }} aria-label={item.title + " 샘플 조회 URL과 설명 복사"} title="GET 메서드, 전체 URL, 설명 복사" className="ui-icon-button size-7 text-brand-primary">{copiedSampleKey === item.sampleKey ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); preview(item); }} aria-label={item.title + " 미리 보기"} title="미리 보기" className="ui-icon-button size-7 text-brand-primary"><Eye className="size-3.5" /></button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); editSample.mutate(item.sampleKey); }} disabled={editSample.isPending || save.isPending} aria-label={item.title + " 제목과 본문 수정"} className="ui-icon-button h-7 px-2 text-[10px] font-black disabled:opacity-50">수정</button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); if (window.confirm(`'${item.title}' 예제를 삭제할까요?`)) remove.mutate(item.sampleKey); }} disabled={remove.isPending} aria-label={item.title + " 샘플 삭제"} title="삭제" className="ui-icon-button size-7 text-destructive disabled:opacity-50"><Trash2 className="size-3.5" /></button>
                  </div>
                  {remove.isError && <p role="alert" className="mt-1 text-[10px] font-bold text-destructive">삭제 실패</p>}
                </td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
      {showInlinePreview && <div className="min-h-0 p-4">
        {!sampleKey ? <div className="grid min-h-[320px] place-items-center rounded-lg border border-dashed border-surface-border-soft text-sm font-bold text-text-muted">등록된 예제가 없습니다.</div> : sample.isLoading ? (
          <div className="grid min-h-[320px] place-items-center rounded-lg border border-surface-border-soft bg-surface-muted text-sm font-bold text-text-muted">샘플 노트를 불러오는 중입니다.</div>
        ) : sample.isError || !sample.data ? (
          <div role="alert" className="grid min-h-[320px] place-items-center rounded-lg border border-destructive/30 bg-destructive/5 px-6 text-center text-sm font-bold text-destructive">구현 노트 기준 샘플을 불러오지 못했습니다. 내부 샘플 데이터를 확인해 주세요.</div>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between gap-3">
              {editing ? <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-2"><input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="예제 제목" className="ui-input h-8 min-w-0 text-sm font-black" /><input value={sampleKeyDraft} onChange={(event) => setSampleKeyDraft(event.target.value.toUpperCase())} aria-label="예제 키" className="ui-input h-8 min-w-0 font-mono text-xs" /></div> : <p className="min-w-0 truncate text-sm font-black text-text-primary">{sample.data.title}</p>}
              <div className="flex shrink-0 items-center gap-1.5">
                {!editing && <span className="hidden rounded bg-surface-muted px-2 py-1 font-mono text-[10px] text-text-muted xl:inline">GET /samples/{sample.data.sampleKey}</span>}
                {editing ? <><button type="button" onClick={cancelEdit} disabled={save.isPending} className="ui-icon-button h-7 px-2 text-[10px] font-black">취소</button><button type="button" onClick={() => save.mutate()} disabled={save.isPending || !title.trim() || !sampleKeyDraft.trim()} className="ui-icon-button-brand h-7 px-2 text-[10px] font-black disabled:opacity-50">{save.isPending ? "저장 중" : "저장"}</button></> : <><button type="button" onClick={beginEdit} className="ui-icon-button h-7 px-2 text-[10px] font-black text-brand-primary">편집</button><button type="button" disabled={remove.isPending} onClick={() => { if (window.confirm(`'${sample.data.title}' 예제를 삭제할까요?`)) remove.mutate(sample.data.sampleKey); }} className="ui-icon-button h-7 px-2 text-[10px] font-black text-destructive disabled:opacity-50">삭제</button></>}
              </div>
            </div>
            {save.isError && <p role="alert" className="mb-2 text-xs font-bold text-destructive">{save.error instanceof Error ? save.error.message : "예제를 저장하지 못했습니다."}</p>}
            <LexicalEditor key={editing ? `${sampleKey}-editing-${sample.data.version}` : `${sampleKey}-${sample.data.version}`} initialState={editing ? content : sample.data.content} onChange={editing ? setContent : () => undefined} readOnly={!editing} minHeight={minHeight} scrollable />
          </>
        )}
      </div>}
      <Dialog.Root open={adding} onOpenChange={(open) => { if (!create.isPending) setAdding(open); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[140] bg-black/40" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-[141] flex h-[min(860px,calc(100dvh-2rem))] w-[min(1080px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-raised shadow-2xl focus:outline-none"
            onOpenAutoFocus={(event) => { event.preventDefault(); newTitleRef.current?.focus(); }}
            onEscapeKeyDown={(event) => { event.stopPropagation(); if (create.isPending) event.preventDefault(); }}
            onInteractOutside={(event) => event.preventDefault()}
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-surface-border-soft px-5 py-4">
              <div>
                <Dialog.Title className="text-lg font-black text-text-primary">노트 예제 추가</Dialog.Title>
                <Dialog.Description className="mt-1 text-xs font-semibold text-text-muted">다른 노트를 작성할 때 참고할 예제의 제목과 본문을 작성하세요.</Dialog.Description>
              </div>
              <Dialog.Close disabled={create.isPending} aria-label="예제 추가 닫기" className="ui-icon-button size-8"><X className="size-4" /></Dialog.Close>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <fieldset disabled={create.isPending} className="min-w-0">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-black text-text-primary">예제 제목
                    <input ref={newTitleRef} value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="예: 프론트 노트 정리" className="ui-input mt-2 h-10 w-full text-sm" />
                  </label>
                  <label className="block text-xs font-black text-text-primary">예제 키
                    <input value={newKey} onChange={(event) => setNewKey(event.target.value.toUpperCase())} placeholder="예: FRONT_NOTE" className="ui-input mt-2 h-10 w-full font-mono text-sm" />
                    <span className="mt-1.5 block text-[11px] font-semibold text-text-muted">예제를 조회할 때 사용할 고유한 키입니다.</span>
                  </label>
                </div>
                <section aria-label="예제 본문" className="mt-5">
                  <h3 className="mb-2 text-sm font-black text-text-primary">예제 본문</h3>
                  <div className="overflow-hidden rounded-lg border border-surface-border-soft">
                    <LexicalEditor initialState={newContent} onChange={setNewContent} readOnly={create.isPending} placeholder="예제 본문을 입력하세요..." minHeight="360px" />
                  </div>
                </section>
              </fieldset>
              {create.isError && <p role="alert" className="mt-3 text-xs font-bold text-destructive">{create.error instanceof Error ? create.error.message : "예제를 추가하지 못했습니다."}</p>}
            </div>
            <footer className="flex shrink-0 justify-end gap-2 border-t border-surface-border-soft px-5 py-3">
              <Dialog.Close disabled={create.isPending} className="ui-icon-button h-9 px-4 text-xs font-black">취소</Dialog.Close>
              <button type="button" disabled={create.isPending || !newKey.trim() || !newTitle.trim()} onClick={() => create.mutate()} className="ui-icon-button-brand h-9 px-4 text-xs font-black disabled:opacity-50">{create.isPending ? "추가 중..." : "예제 추가"}</button>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {!showInlinePreview && previewDialogOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={editing ? "작성 샘플 수정" : "작성 샘플 미리 보기"} onMouseDown={() => { if (!editing && !save.isPending) setPreviewDialogOpen(false); }}>
          <section className="flex h-[min(820px,calc(100vh-2rem))] w-[min(980px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-raised shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-surface-border-soft px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-lg font-black text-text-primary">{editing ? "작성 샘플 수정" : "작성 샘플 미리 보기"}</h2>
                <p className="mt-1 truncate text-xs font-semibold text-text-muted">{editing ? "제목과 본문을 수정한 뒤 저장하세요." : sample.data?.title ?? "샘플을 불러오는 중입니다."}</p>
              </div>
              <button type="button" onClick={() => setPreviewDialogOpen(false)} disabled={save.isPending} aria-label="작성 샘플 닫기" className="ui-icon-button size-8 shrink-0 disabled:opacity-50"><X className="size-4" /></button>
            </header>
            <div className="min-h-0 flex-1 overflow-auto p-5">
              {editing && <fieldset disabled={save.isPending} className="mb-5 grid min-w-0 gap-4 sm:grid-cols-2">
                <label className="block text-xs font-black text-text-primary">예제 제목
                  <input value={title} onChange={(event) => setTitle(event.target.value)} className="ui-input mt-2 h-10 w-full text-sm" />
                </label>
                <label className="block text-xs font-black text-text-primary">예제 키
                  <input value={sampleKeyDraft} onChange={(event) => setSampleKeyDraft(event.target.value.toUpperCase())} className="ui-input mt-2 h-10 w-full font-mono text-sm" />
                </label>
              </fieldset>}
              {save.isError && <p role="alert" className="mb-3 text-xs font-bold text-destructive">{save.error instanceof Error ? save.error.message : "예제를 저장하지 못했습니다."}</p>}
              {sample.isLoading ? <div className="grid h-full min-h-[320px] place-items-center text-sm font-bold text-text-muted">샘플 노트를 불러오는 중입니다.</div> : sample.isError || !sample.data ? <div role="alert" className="grid h-full min-h-[320px] place-items-center text-sm font-bold text-destructive">샘플 노트를 불러오지 못했습니다.</div> : <LexicalEditor key={editing ? `${sample.data.sampleKey}-editing-${sample.data.version}` : `${sample.data.sampleKey}-${sample.data.version}`} initialState={editing ? content : sample.data.content} onChange={editing ? setContent : () => undefined} readOnly={!editing} minHeight="520px" scrollable />}
            </div>
            <footer className="flex shrink-0 justify-end gap-2 border-t border-surface-border-soft bg-surface-raised px-5 py-3">
              {editing ? <>
                <button type="button" onClick={cancelEdit} disabled={save.isPending} className="ui-icon-button h-9 px-4 text-xs font-black">취소</button>
                <button type="button" onClick={() => save.mutate()} disabled={save.isPending || !title.trim() || !sampleKeyDraft.trim()} className="ui-icon-button-brand h-9 px-4 text-xs font-black disabled:opacity-50">{save.isPending ? "저장 중..." : "저장"}</button>
              </> : <>
                <button type="button" onClick={() => setPreviewDialogOpen(false)} className="ui-icon-button h-9 px-4 text-xs font-black">닫기</button>
                {sample.data && <button type="button" onClick={beginEdit} className="ui-icon-button-brand h-9 px-4 text-xs font-black">본문 수정</button>}
              </>}
            </footer>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}
