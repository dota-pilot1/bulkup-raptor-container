"use client";

import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Dialog } from "@/shared/ui/dialog";
import type { BulkCancellationResult } from "../api/cancel-order";

export function BulkCancelDialog({ isOpen, count, reason, pending, error, onReason, onClose, onConfirm }: {
  isOpen: boolean;
  count: number;
  reason: string;
  pending: boolean;
  error?: string | null;
  onReason: (reason: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return <ConfirmDialog isOpen={isOpen} title={`선택한 ${count}건을 취소할까요?`}
    description="배송 준비 중인 주문의 결제 금액 전액을 취소합니다. 결제 취소가 확인되면 주문을 취소하고 배송을 중단합니다."
    confirmLabel="선택 취소" cancelLabel="돌아가기" isPending={pending} onClose={onClose} onConfirm={onConfirm}>
    <label className="mt-4 block text-sm font-medium text-zinc-700">
      취소 사유 <span className="font-normal text-zinc-400">(선택)</span>
      <textarea value={reason} onChange={event => onReason(event.target.value)} maxLength={200} disabled={pending}
        rows={3} placeholder="취소 사유를 입력해 주세요."
        className="mt-2 block w-full resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm font-normal focus:border-emerald-600 focus:outline-none disabled:opacity-50" />
      <span className="mt-1 block text-right text-xs font-normal text-zinc-400">{reason.length}/200자</span>
    </label>
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
  </ConfirmDialog>;
}

export function BulkCancelSummary({ result }: { result: BulkCancellationResult }) {
  const succeeded = result.results.filter(item => item.succeeded).length;
  const failed = result.results.filter(item => !item.succeeded);
  return <div className="space-y-3 text-sm leading-relaxed text-zinc-600">
    <p role="status">{succeeded}건을 취소했습니다.</p>
    {failed.length > 0 && <ul className="space-y-2">
      {failed.map(item => <li key={item.orderId} role="alert">주문 #{item.orderId} {item.message || "취소하지 못했습니다."}</li>)}
    </ul>}
  </div>;
}

export function BulkCancelResultDialog({ result, onClose }: { result: BulkCancellationResult | null; onClose: () => void }) {
  return <Dialog isOpen={result !== null} title="선택 취소 결과" onClose={onClose}
    footer={<button type="button" onClick={onClose} className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">확인</button>}>
    {result && <BulkCancelSummary result={result} />}
  </Dialog>;
}
