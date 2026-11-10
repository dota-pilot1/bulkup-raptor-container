"use client";

import { useState } from "react";
import { ApiError } from "@/shared/api/client";
import type { DeliveryInfo, DeliveryStatus } from "@/entities/delivery/model/delivery-types";
import { useChangeDeliveryStatus } from "../model/use-change-delivery-status";

export function ChangeDeliveryStatus({ memberId, delivery, disabled }: {
  memberId: number; delivery: DeliveryInfo; disabled: boolean;
}) {
  const [reason, setReason] = useState("");
  const change = useChangeDeliveryStatus(memberId, delivery.deliveryId);
  const next: DeliveryStatus | null = delivery.status === "PREPARING" ? "OUT_FOR_DELIVERY" : delivery.status === "OUT_FOR_DELIVERY" ? "DELIVERED" : null;
  const message = change.error instanceof ApiError && change.error.status === 409
    ? "다른 처리로 배송 정보가 변경되었습니다. 최신 상태를 확인한 뒤 다시 진행해 주세요."
    : change.error ? "배송 변경 결과를 확인하지 못했습니다. 최신 상태를 확인한 뒤 다시 진행해 주세요." : null;
  return <section aria-label="배송 상태 변경" className="mt-6 border-t border-zinc-200 pt-5">
    {message && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-sm leading-6 text-rose-700">{message}</p>}
    {change.isSuccess && <p role="status" className="mb-4 text-sm font-semibold text-emerald-700">배송 상태를 변경했습니다.</p>}
    {next ? <form onSubmit={event => {
      event.preventDefault();
      if (!disabled && !change.isPending) void change.submit({ status: next, expectedVersion: delivery.version, reason });
    }}>
      <label className="block text-xs font-semibold text-zinc-700">전달 메모 · 선택
        <textarea value={reason} maxLength={500} disabled={change.isPending} onChange={event => { setReason(event.target.value); change.reset(); }}
          placeholder="전달할 내용이나 처리 사유를 입력하세요." rows={2}
          className="mt-2 block w-full resize-y rounded-xl border border-zinc-200 p-3 text-sm font-normal outline-none focus:border-emerald-600 disabled:opacity-50" />
      </label>
      <div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-zinc-400">{reason.length}/500자</span>
        <button type="submit" disabled={disabled || change.isPending} className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-40">
          {change.isPending ? "처리 중…" : next === "OUT_FOR_DELIVERY" ? "배송 시작" : "전달 완료 처리"}
        </button>
      </div>
    </form> : <p className="text-sm text-zinc-500">직원에게 전달이 완료된 주문입니다.</p>}
  </section>;
}
