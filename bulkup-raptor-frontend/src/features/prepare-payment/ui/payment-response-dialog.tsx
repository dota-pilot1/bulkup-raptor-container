"use client";

import Link from "next/link";
import type { OrderResponse } from "@/entities/order/model/order-types";
import { Dialog } from "@/shared/ui/dialog";
import { paymentResultMessage, type PaymentResult, type PaymentResponse } from "../model/payment-result";
import { PaymentOrderItems } from "./payment-order-items";

const fields: [keyof PaymentResponse, string][] = [
  ["paymentId", "결제 ID"], ["txId", "거래 시도 ID"], ["transactionType", "요청 종류"],
  ["code", "오류 코드"], ["message", "오류 메시지"], ["pgCode", "카카오페이 오류 코드"], ["pgMessage", "카카오페이 오류 메시지"],
];

export function PaymentResponseDialog({ result, order: suppliedOrder, isOpen, onClose }: {
  result: PaymentResult;
  order?: OrderResponse;
  isOpen: boolean;
  onClose: () => void;
}) {
  const verification = result.verification;
  const verified = result.status === "verified";
  // 검증한 주문과 일치하는 상품·배송 정보만 함께 표시한다.
  const order = suppliedOrder?.orderId === verification?.orderId ? suppliedOrder : undefined;
  const paymentMethod = verification?.paymentMethod === "KAKAOPAY" ? "카카오페이" : verification?.paymentMethod || "확인되지 않음";
  const paidAt = verification?.paidAt ? new Date(verification.paidAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "미결제";
  // 긴 식별자는 접을 수 있는 상세 영역에 모아 표시한다.
  const transactionFields = verification ? [
    ["결제 ID", verification.paymentId], ["거래 ID", verification.transactionId || "응답 없음"], ["카카오페이 거래 ID", verification.pgTxId || "응답 없음"],
  ] : [];

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      scrollable
      title={verified ? "결제가 완료되었습니다" : verification ? "결제 상태 확인" : "포트원 결제 응답"}
      description={verified ? "주문이 정상적으로 접수되었습니다. 결제 내역을 확인해 주세요." : verification ? "서버가 포트원에서 조회한 결제 정보입니다." : "결제창에서 받은 응답 정보입니다."}
      maxWidthClassName={verification ? "max-w-5xl" : "max-w-lg"}
      footer={<>
        <button type="button" onClick={onClose} className="rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">확인</button>
        {verification && <Link href={`/orders/${verification.orderId}`} onClick={onClose} className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">주문 상세 보기</Link>}
      </>}
    >
      <div className="pr-1">
        {verification ? <>
          <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <section className="min-w-0 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 sm:p-5">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-zinc-900">주문 상품</h3>
                <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-500">주문 #{verification.orderId}</span>
              </div>
              {order ? <>
                <PaymentOrderItems order={order} />
                <p className="mt-4 border-t border-zinc-200/70 pt-3 text-xs text-zinc-500">상품 {order.items.length}종 · 총 {order.items.reduce((sum, item) => sum + item.quantity, 0)}개</p>
              </> : <p className="py-5 text-sm font-medium leading-relaxed text-zinc-800">{verification.orderName}</p>}
              {order && <div className="mt-5 rounded-xl border border-zinc-200/70 bg-white p-4">
                <h4 className="text-xs font-semibold text-zinc-500">배송 정보</h4>
                <p className="mt-2 text-sm font-semibold text-zinc-900">{order.delivery.recipientName}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">({order.delivery.postalCode}) {order.delivery.address} {order.delivery.addressDetail}</p>
              </div>}
            </section>

            <section className="min-w-0 rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-zinc-900">결제 내역</h3>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${verified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                  <span aria-hidden="true" className={`size-1.5 rounded-full ${verified ? "bg-emerald-600" : "bg-amber-600"}`} />
                  {verified ? "서버 검증 완료" : verification.providerStatus}
                </span>
              </div>
              <p className="mt-6 text-xs text-zinc-500">{verified ? "총 결제 금액" : "주문 금액"}</p>
              <p className="mt-1.5 break-words text-3xl font-extrabold tracking-tight tabular-nums text-emerald-700">{verification.totalAmount.toLocaleString("ko-KR")}<span className="ml-1 text-base font-semibold">원</span></p>
              <p className="mt-1 text-[11px] text-zinc-400">{verification.currency}</p>
              <dl className="mt-5 space-y-3 border-t border-zinc-100 pt-4 text-sm">
                {order && <>
                  <div className="flex justify-between gap-4"><dt className="text-zinc-500">상품 금액</dt><dd className="font-medium tabular-nums">{order.itemsTotal.toLocaleString("ko-KR")}원</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-zinc-500">배송비</dt><dd className="font-medium">{order.shippingFee === 0 ? "무료" : `${order.shippingFee.toLocaleString("ko-KR")}원`}</dd></div>
                </>}
                <div className="flex justify-between gap-4"><dt className="text-zinc-500">결제 수단</dt><dd className="font-semibold text-zinc-900">{paymentMethod}</dd></div>
                <div className="flex justify-between gap-4"><dt className="shrink-0 text-zinc-500">결제 시각</dt><dd className="text-right text-xs leading-5 text-zinc-700">{paidAt}</dd></div>
              </dl>
              <div className={`mt-5 flex items-start gap-2.5 rounded-xl p-3 ${verified ? "bg-emerald-50/80 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
                <span aria-hidden="true" className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold">{verified ? "✓" : "!"}</span>
                <p className="text-xs leading-relaxed">{paymentResultMessage(result)}</p>
              </div>
            </section>
          </div>
          <details className="mt-4 rounded-xl border border-zinc-200/80 bg-white px-4 py-3">
            <summary className="cursor-pointer text-xs font-medium text-zinc-500">결제 ID 및 거래 정보</summary>
            <dl className="mt-3 grid gap-3 border-t border-zinc-100 pt-3 sm:grid-cols-2">
              {transactionFields.map(([label, value], index) => <div key={label} className={index === 0 ? "sm:col-span-2" : ""}><dt className="text-[11px] text-zinc-400">{label}</dt><dd className="mt-1 break-all font-mono text-[11px] leading-relaxed text-zinc-600">{value}</dd></div>)}
            </dl>
          </details>
        </> : <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-800">서버 검증 전</p><p className="mt-1 text-sm leading-relaxed text-amber-900">{paymentResultMessage(result)}</p></div>
          <dl className="divide-y divide-gray-100 rounded-xl border border-gray-200 px-4">
            {fields.map(([key, label]) => <div key={key} className="py-3"><dt className="text-xs text-gray-500">{label} <span className="ml-1 font-mono text-gray-400">{key}</span></dt><dd className="mt-1.5 break-all font-mono text-xs leading-relaxed text-gray-900">{result.response?.[key] || (key === "paymentId" ? result.paymentId : undefined) || <span className="font-sans text-gray-400">응답 없음</span>}</dd></div>)}
          </dl>
        </div>}
      </div>
    </Dialog>
  );
}
