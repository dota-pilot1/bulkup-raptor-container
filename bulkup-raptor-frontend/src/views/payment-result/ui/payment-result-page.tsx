"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useOrder } from "@/entities/order/model/use-order";
import { Header } from "@/widgets/header/ui/header";
import { paymentResultMessage, verifiedPaymentResult, type PaymentResult } from "@/features/prepare-payment/model/payment-result";
import { useVerifyPaymentResult } from "@/features/prepare-payment/model/use-verify-payment-result";
import { PaymentResponseDialog } from "@/features/prepare-payment/ui/payment-response-dialog";

export default function PaymentResultPage({ result: sdkResult }: { result: PaymentResult }) {
  const verification = useVerifyPaymentResult(sdkResult.paymentId);
  const result = useMemo(() => verification.data ? verifiedPaymentResult(verification.data, sdkResult.response) : sdkResult, [verification.data, sdkResult]);
  const order = useOrder(verification.memberId, verification.data?.orderId ?? NaN);
  const [isOpen, setIsOpen] = useState(true);
  const title = {
    verified: "결제가 완료되었습니다",
    unpaid: "결제 상태를 확인했습니다",
    received: "결제 응답을 받았습니다",
    cancelled: "결제를 취소했습니다",
    failed: "결제를 진행하지 못했습니다",
    unknown: "결제 결과를 확인해 주세요",
  }[result.status];

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-16">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
          <p className="text-xs font-semibold tracking-widest text-emerald-700">PAYMENT</p>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">{title}</h1>
          {verification.isChecking && <p role="status" className="mt-4 text-sm text-emerald-700">결제 상태를 확인하고 있습니다.</p>}
          {verification.needsLogin && <Link href="/login" className="mt-4 block text-sm font-semibold text-emerald-700 underline">로그인 후 결제 결과 확인</Link>}
          {verification.error && <div role="alert" className="mt-4 text-sm text-red-600">{verification.error.message}<button type="button" onClick={() => void verification.retry()} className="ml-2 underline">다시 확인</button></div>}
          <p role="status" className="mt-4 text-sm leading-relaxed text-gray-600">{paymentResultMessage(result)}</p>
          {result.paymentId && (
            <dl className="mt-6 rounded-xl bg-gray-50 p-4">
              <dt className="text-xs text-gray-500">결제 ID</dt>
              <dd className="mt-2 break-all font-mono text-xs text-gray-700">{result.paymentId}</dd>
            </dl>
          )}
          <button type="button" onClick={() => setIsOpen(true)} className="mt-5 text-sm font-semibold text-emerald-700 underline underline-offset-4">포트원 응답 보기</button>
          <Link href="/orders" className="mt-6 flex h-12 items-center justify-center rounded-xl bg-emerald-700 text-sm font-semibold text-white hover:bg-emerald-800">
            주문 내역 보기
          </Link>
        </section>
      </main>
      <PaymentResponseDialog result={result} order={order.data} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
