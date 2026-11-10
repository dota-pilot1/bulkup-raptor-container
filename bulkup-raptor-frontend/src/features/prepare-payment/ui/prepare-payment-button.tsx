"use client";

import { useState } from "react";
import { ApiError } from "@/shared/api/client";
import { Dialog } from "@/shared/ui/dialog";
import type { OrderResponse } from "@/entities/order/model/order-types";
import { useRequestPayment } from "../model/use-request-payment";
import { paymentResultMessage, type PaymentResult } from "../model/payment-result";
import { PaymentResponseDialog } from "./payment-response-dialog";

type PreparePaymentButtonProps = {
  order: OrderResponse;
  memberId: number;
};

export function PreparePaymentButton({ order, memberId }: PreparePaymentButtonProps) {
  // 요청과 재요청 처리는 훅에 맡기고, 버튼은 요청 상태를 표시한다.
  const payment = useRequestPayment(memberId, order.orderId);
  const [dismissedResult, setDismissedResult] = useState<PaymentResult | null>(null);
  const [dismissedError, setDismissedError] = useState<Error | null>(null);
  const stockInsufficient = payment.error instanceof ApiError && payment.error.code === "STOCK_INSUFFICIENT";
  const checkOnly = order.status === "PAID" || payment.result?.status === "verified";
  const closeError = () => setDismissedError(payment.error);
  const result = !payment.isPending && !payment.error ? payment.result : null;

  if (order.cancellationPending || !["CREATED", "PAID"].includes(order.status)) return null;

  let buttonLabel = order.status === "PAID" ? "결제 내역 보기" : `${order.totalAmount.toLocaleString("ko-KR")}원 결제하기`;
  if (payment.isPending) {
    buttonLabel = payment.isPreparing ? "결제 정보 확인 중…" : payment.isVerifying ? "결제 상태 확인 중…" : "결제창 진행 중…";
  } else if (payment.result?.status === "verified" || order.status === "PAID") {
    buttonLabel = "결제 내역 보기";
  } else if (payment.result?.status === "received") {
    buttonLabel = "결제 응답 수신 · 확인 필요";
  } else if (stockInsufficient) {
    buttonLabel = "재고 다시 확인";
  }

  // 재요청 중이거나 실패한 경우에는 이전 성공 결과를 표시하지 않는다.
  const preparedPayment =
    !payment.isPending && !payment.error ? payment.data : undefined;

  return (
    <div className="mt-6">
      <button
        type="button"
        disabled={payment.isPending}
        onClick={() => void payment.submit(checkOnly)}
        className="flex h-12 w-full cursor-pointer items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600 disabled:cursor-wait disabled:opacity-60"
      >
        {buttonLabel}
      </button>

      {payment.error && (
        <Dialog
          isOpen={!payment.isPending && dismissedError !== payment.error}
          title={stockInsufficient ? "상품 재고가 부족합니다" : "결제 정보를 확인해 주세요"}
          onClose={closeError}
          footer={
            <button type="button" onClick={closeError}
              className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
              확인
            </button>
          }
        >
          <p role="alert" className="text-sm leading-relaxed text-zinc-600">
            {stockInsufficient
              ? "주문 상품 중 구매 가능한 재고가 부족한 상품이 있습니다. 상품 수량을 확인해 주세요."
              : payment.error.message}
          </p>
        </Dialog>
      )}

      {!payment.isPending && !payment.error && payment.result && (
        <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm leading-relaxed text-gray-600">
          <p role="status">{paymentResultMessage(payment.result)}</p>
          <button type="button" onClick={() => setDismissedResult(null)} className="mt-2 font-semibold text-emerald-700 underline underline-offset-4">
            결제 결과 보기
          </button>
        </div>
      )}

      {result && <PaymentResponseDialog result={result} order={order} isOpen={dismissedResult !== result} onClose={() => setDismissedResult(result)} />}

      {preparedPayment && (
        <div
          role="status"
          className="mt-3 overflow-hidden rounded-xl border border-emerald-100 bg-white text-sm"
        >
          <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50/70 px-4 py-3">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none" className="size-3">
                <path d="m3.5 8 3 3 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="font-semibold text-emerald-900">{order.status === "PAID" ? "결제 완료" : "결제 준비 완료"}</p>
          </div>
          <dl className="space-y-4 p-4">
            <div>
              <dt className="text-xs text-gray-500">주문명 <span className="ml-1 text-[10px] text-gray-400">orderName</span></dt>
              <dd className="mt-1.5 break-words font-medium text-gray-900">{preparedPayment.orderName}</dd>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-b border-gray-100 pb-4">
              <div>
                <dt className="text-xs text-gray-500">결제 금액 <span className="ml-1 text-[10px] text-gray-400">totalAmount</span></dt>
                <dd className="mt-1.5 text-2xl font-bold tracking-tight text-emerald-700">
                  {preparedPayment.totalAmount.toLocaleString("ko-KR")}<span className="ml-0.5 text-sm font-medium">원</span>
                </dd>
              </div>
              <div className="text-right">
                <dt className="text-xs text-gray-500">통화 <span className="ml-1 text-[10px] text-gray-400">currency</span></dt>
                <dd className="mt-2 inline-flex rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">{preparedPayment.currency}</dd>
              </div>
            </div>
            <div>
              <dt className="text-xs text-gray-500">결제 ID <span className="ml-1 text-[10px] text-gray-400">paymentId</span></dt>
              <dd className="mt-2 rounded-lg bg-gray-50 px-3 py-2 font-mono text-[11px] leading-relaxed break-all text-gray-600">{preparedPayment.paymentId}</dd>
            </div>
          </dl>
          <p className="border-t border-gray-100 bg-gray-50/70 px-4 py-3 text-xs leading-relaxed text-gray-500">
            {order.status === "PAID" ? "서버 검증이 완료된 결제 정보입니다." : "서버에서 준비한 결제 정보입니다. 결제 완료 여부는 별도로 확인합니다."}
          </p>
        </div>
      )}
    </div>
  );
}
