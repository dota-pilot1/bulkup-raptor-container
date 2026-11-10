"use client";

import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Dialog } from "@/shared/ui/dialog";
import type { StartDeliveriesResult } from "@/entities/delivery/api/deliveries";

export type DeliveryAdvance = "OUT_FOR_DELIVERY" | "DELIVERED";

const copy = {
  OUT_FOR_DELIVERY: {
    one: "이 주문을 배송 중으로 바꿀까요?",
    many: (count: number) => `선택한 ${count}건을 배송 중으로 바꿀까요?`,
    description: "배송 준비 중인 결제 완료 주문을 배송 중으로 바꿉니다.",
    confirm: "배송 시작",
    resultTitle: "배송 시작 결과",
    done: (count: number) => `${count}건을 배송 중으로 바꿨습니다.`,
    failed: "배송을 시작하지 못했습니다.",
  },
  DELIVERED: {
    one: "이 주문을 전달 완료로 바꿀까요?",
    many: (count: number) => `선택한 ${count}건을 전달 완료로 바꿀까요?`,
    description: "배송 중인 주문을 전달 완료로 바꿉니다.",
    confirm: "전달 완료",
    resultTitle: "전달 완료 결과",
    done: (count: number) => `${count}건을 전달 완료로 바꿨습니다.`,
    failed: "전달 완료로 바꾸지 못했습니다.",
  },
};

export function StartDeliveryDialog({ isOpen, count, target = "OUT_FOR_DELIVERY", pending, error, onClose, onConfirm }: {
  isOpen: boolean;
  count: number;
  target?: DeliveryAdvance;
  pending: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const text = copy[target];
  return <ConfirmDialog isOpen={isOpen} title={count === 1 ? text.one : text.many(count)}
    description={text.description}
    confirmLabel={text.confirm} cancelLabel="돌아가기" isPending={pending} onClose={onClose} onConfirm={onConfirm}>
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
  </ConfirmDialog>;
}

export function StartDeliveryResultDialog({ result, target = "OUT_FOR_DELIVERY", onClose }: {
  result: StartDeliveriesResult | null;
  target?: DeliveryAdvance;
  onClose: () => void;
}) {
  const text = copy[target];
  const succeeded = result?.results.filter(item => item.succeeded).length ?? 0;
  const failed = result?.results.filter(item => !item.succeeded) ?? [];
  return <Dialog isOpen={result !== null} title={text.resultTitle} onClose={onClose}
    footer={<button type="button" onClick={onClose} className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">확인</button>}>
    {result && <div className="space-y-3 text-sm leading-relaxed text-zinc-600">
      <p role="status">{text.done(succeeded)}</p>
      {failed.length > 0 && <ul className="space-y-2">
        {failed.map(item => <li key={item.orderId} role="alert">주문 #{item.orderId} {item.message || text.failed}</li>)}
      </ul>}
    </div>}
  </Dialog>;
}
