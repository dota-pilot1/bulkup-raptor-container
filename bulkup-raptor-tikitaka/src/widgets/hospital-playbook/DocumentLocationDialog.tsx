import { Check, ChevronRight, FolderTree, Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { PlaybookDocumentSummary } from "../../features/hospital-playbook/api";

type TreeRow = { document: PlaybookDocumentSummary; depth: number };

function documentTreeRows(documents: PlaybookDocumentSummary[]) {
  const byParentId = new Map<number | null, PlaybookDocumentSummary[]>();
  for (const document of documents) {
    const siblings = byParentId.get(document.parentId) ?? [];
    siblings.push(document);
    byParentId.set(document.parentId, siblings);
  }

  const rows: TreeRow[] = [];
  const visit = (parentId: number | null, depth: number) => {
    for (const document of byParentId.get(parentId) ?? []) {
      rows.push({ document, depth });
      visit(document.id, depth + 1);
    }
  };
  visit(null, 0);
  return { rows, byParentId };
}

function descendantIds(documentId: number, byParentId: Map<number | null, PlaybookDocumentSummary[]>) {
  const ids = new Set<number>([documentId]);
  const visit = (parentId: number) => {
    for (const child of byParentId.get(parentId) ?? []) {
      ids.add(child.id);
      visit(child.id);
    }
  };
  visit(documentId);
  return ids;
}

/** 현재 문서를 같은 주제 안의 루트 또는 다른 본문 아래로 옮기는 선택 창. */
export default function DocumentLocationDialog({
  document,
  documents,
  onClose,
  onMove,
}: {
  document: PlaybookDocumentSummary;
  documents: PlaybookDocumentSummary[];
  onClose: () => void;
  onMove: (parentId: number | null) => Promise<void>;
}) {
  const { rows, byParentId } = useMemo(() => documentTreeRows(documents), [documents]);
  const unavailableIds = useMemo(() => descendantIds(document.id, byParentId), [document.id, byParentId]);
  const [selectedParentId, setSelectedParentId] = useState<number | null>(document.parentId);
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState("");
  const changed = selectedParentId !== document.parentId;

  const move = async () => {
    if (!changed || isMoving) return;
    setIsMoving(true);
    setError("");
    try {
      await onMove(selectedParentId);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "문서 위치를 변경하지 못했습니다.");
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/35 p-5" role="dialog" aria-modal="true" aria-label="문서 위치 이동">
      <div className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-raised shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-surface-border px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-brand-primary"><FolderTree className="size-4" /><h3 className="text-base font-black">문서 위치 이동</h3></div>
            <p className="mt-1 text-xs font-semibold leading-5 text-text-muted">루트 본문 또는 다른 본문을 선택하세요. 현재 문서와 그 하위 문서는 순환 구조를 막기 위해 선택할 수 없습니다.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isMoving} className="ui-icon-button size-8 shrink-0" title="닫기" aria-label="닫기"><X className="size-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <button
            type="button"
            onClick={() => { setSelectedParentId(null); setError(""); }}
            className={`flex w-full items-center gap-2 rounded-lg border px-3 py-3 text-left transition ${selectedParentId === null ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-surface-border-soft hover:bg-surface-muted"}`}
          >
            <span className="grid size-6 place-items-center rounded-md bg-surface-muted"><FolderTree className="size-3.5" /></span>
            <span className="flex-1 text-sm font-black">루트 본문으로 이동</span>
            {selectedParentId === null && <Check className="size-4" />}
          </button>

          <p className="mt-5 px-1 text-[11px] font-black text-text-muted">다른 본문 아래로 이동</p>
          <div className="mt-2 grid gap-1">
            {rows.map(({ document: target, depth }) => {
              const unavailable = unavailableIds.has(target.id);
              const selected = selectedParentId === target.id;
              return (
                <button
                  key={target.id}
                  type="button"
                  disabled={unavailable}
                  onClick={() => { setSelectedParentId(target.id); setError(""); }}
                  style={{ marginLeft: `${depth * 18}px`, width: `calc(100% - ${depth * 18}px)` }}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition ${selected ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-surface-border-soft hover:bg-surface-muted"} ${unavailable ? "cursor-not-allowed border-transparent bg-surface-muted/60 text-text-muted opacity-60" : ""}`}
                >
                  <ChevronRight className={`size-3.5 shrink-0 ${depth ? "text-brand-primary" : "text-text-muted"}`} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{target.title}</span>
                  {target.id === document.id ? <span className="shrink-0 text-[10px] font-black">현재 문서</span> : unavailable ? <span className="shrink-0 text-[10px] font-black">하위 문서</span> : selected ? <Check className="size-4 shrink-0" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-surface-border px-5 py-3">
          <p className="min-w-0 text-xs font-bold text-destructive">{error}</p>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={onClose} disabled={isMoving} className="ui-icon-button h-9 px-3 text-xs font-black">취소</button>
            <button type="button" onClick={() => void move()} disabled={!changed || isMoving} className="ui-icon-button-brand h-9 gap-1.5 px-3 text-xs font-black disabled:opacity-40">
              {isMoving && <Loader2 className="size-3.5 animate-spin" />} 이동
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
