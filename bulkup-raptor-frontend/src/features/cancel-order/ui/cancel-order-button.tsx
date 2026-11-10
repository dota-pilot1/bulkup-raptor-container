"use client";

import { useEffect, useEffectEvent, useState } from "react";
import type { OrderResponse } from "@/entities/order/model/order-types";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Dialog } from "@/shared/ui/dialog";
import type { CancellationResult } from "../api/cancel-order";
import { useCancelOrder } from "../model/use-cancel-order";

export type CancellableOrder = Pick<OrderResponse, "orderId" | "status"> & {
  cancellationPending?: boolean;
  inventoryStatus?: string;
  deliveryStatus?: OrderResponse["deliveryStatus"];
};

export function CancelOrderButton({ order, memberId, releaseOnly = false, admin = false, compact = false }: {
  order: CancellableOrder;
  memberId: number;
  releaseOnly?: boolean;
  admin?: boolean;
  compact?: boolean;
}) {
  const cancellation = useCancelOrder(memberId, order.orderId, releaseOnly, admin);
  const action = releaseOnly ? "결제 다시 준비" : "주문 취소";
  const recheck = useEffectEvent(() => { void cancellation.submit(); });
  useEffect(() => {
    if (!order.cancellationPending || releaseOnly) return;
    recheck();
    const timer = setInterval(() => recheck(), 10_000);
    return () => clearInterval(timer);
  }, [order.cancellationPending, order.orderId, memberId, releaseOnly]);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [dismissed, setDismissed] = useState<CancellationResult | Error | null>(null);
  const result = cancellation.data;
  const notice = cancellation.error ?? result;
  const pendingResult = result?.pending && order.status !== "CANCELLED";
  const outcome = result?.pending && order.status === "CANCELLED" ? order.status : result?.orderStatus;
  const canCancel = admin
    ? order.status === "PAID" && order.deliveryStatus === "PREPARING"
    : order.status === "CREATED" || (order.status === "PAID" && order.deliveryStatus === "PREPARING");
  const restriction = order.status !== "PAID" ? null
    : order.deliveryStatus === "OUT_FOR_DELIVERY" ? (admin ? "배송 중인 주문은 취소할 수 없습니다." : "배송 중인 주문은 직접 취소할 수 없습니다. 배송 관련 문의를 해 주세요.")
      : order.deliveryStatus === "DELIVERED" ? (admin ? "전달 완료 주문은 취소할 수 없습니다." : "전달 완료 주문은 직접 취소할 수 없습니다. 반품·환불 절차를 문의해 주세요.")
        : order.deliveryStatus !== "PREPARING" ? "배송 상태를 확인하지 못했습니다. 주문 정보를 새로고침해 주세요." : null;
  const title = cancellation.error ? `${action} 결과를 확인해 주세요`
    : pendingResult ? "취소 처리 중"
    : outcome === "PAID" ? "결제 완료 주문입니다" : releaseOnly && outcome === "CREATED" ? "예약 처리 결과" : "주문 취소됨";

  async function confirm() {
    await cancellation.submit(reason);
    setConfirming(false);
  }

  return <>
    {!compact && !releaseOnly && restriction && <p role="status" className="mt-4 text-sm leading-relaxed text-zinc-600">{restriction}</p>}
    {!compact && !releaseOnly && order.cancellationPending && <p role="status" className="mt-4 text-sm text-zinc-500">주문 취소를 처리하고 있습니다.</p>}
    {compact && !releaseOnly && order.cancellationPending && <p role="status" className="text-xs text-zinc-500">취소 처리 중</p>}
    {!order.cancellationPending && (releaseOnly ? order.status === "CREATED" && order.inventoryStatus === "RESERVED" : canCancel) && <>
      <button type="button" disabled={cancellation.isPending} onClick={() => setConfirming(true)}
        aria-label={compact ? `주문 ${order.orderId} 취소` : undefined}
        className={compact
          ? "rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-50"
          : "mt-3 h-11 w-full cursor-pointer rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-50"}>
        {cancellation.isPending ? "처리 중…" : action}
      </button>
    </>}
    <ConfirmDialog isOpen={confirming} title={`${action} 요청을 보낼까요?`}
      description={releaseOnly
        ? "이전 결제의 종료가 확인되면 재고 예약을 해제합니다. 같은 주문에서 다시 결제할 수 있습니다."
        : order.status === "PAID"
          ? "배송 준비 중인 주문의 결제 금액 전액을 취소합니다. 결제 취소가 확인되면 주문을 취소하고 배송을 중단합니다."
          : "결제 여부를 확인한 뒤 주문을 취소합니다. 결제가 완료된 경우에는 배송 준비 중인 주문만 전액 취소합니다."}
      confirmLabel={action} cancelLabel="돌아가기"
      isPending={cancellation.isPending} onClose={() => setConfirming(false)} onConfirm={() => void confirm()}>
      {!releaseOnly && <label className="mt-4 block text-sm font-medium text-zinc-700">
        취소 사유 <span className="font-normal text-zinc-400">(선택)</span>
        <textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={200} disabled={cancellation.isPending}
          rows={3} placeholder="취소 사유를 입력해 주세요."
          className="mt-2 block w-full resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm font-normal focus:border-emerald-600 focus:outline-none disabled:opacity-50" />
        <span className="mt-1 block text-right text-xs font-normal text-zinc-400">{reason.length}/200자</span>
      </label>}
    </ConfirmDialog>
    <Dialog isOpen={!cancellation.isPending && !confirming && !pendingResult && !order.cancellationPending && !!notice && dismissed !== notice}
      title={title} onClose={() => setDismissed(notice ?? null)}
      footer={<button type="button" onClick={() => setDismissed(notice ?? null)}
        className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">확인</button>}>
      <p role={cancellation.error ? "alert" : "status"} className="text-sm leading-relaxed text-zinc-600">
        {cancellation.error?.message ?? (pendingResult
          ? "주문 취소를 처리하고 있습니다."
          : outcome === "PAID" ? "이미 결제된 주문입니다. 결제 내역을 확인해 주세요."
            : releaseOnly && outcome === "CREATED"
              ? result?.inventoryStatus === "RELEASED" ? "재고 예약을 해제했습니다. 같은 주문에서 다시 결제할 수 있습니다." : "현재 주문 상태를 확인해 주세요."
              : admin ? "주문이 취소되었습니다." : "주문이 취소되었습니다. 취소한 주문은 주문 내역에서 확인할 수 있습니다.")}
      </p>
    </Dialog>
  </>;
}
