"use client";

import { useRef, useState } from "react";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MemberSession } from "@/entities/session";
import { ApiError } from "@/shared/api/client";
import { requestPayment } from "../api/request-payment";
import { verifyPayment } from "../api/verify-payment";
import { verifiedPaymentResult } from "./payment-result";
import { usePreparePayment } from "./use-prepare-payment";

type Input = { member: MemberSession; checkOnly: boolean };

export function useRequestPayment(memberId: number, orderId: number) {
  const client = useQueryClient();
  const preparation = usePreparePayment(memberId, orderId);
  const submitting = useRef(false);
  const [phase, setPhase] = useState<"verify" | "sdk" | null>(null);
  const mutationKey = ["request-payment", memberId, orderId];
  const pending = useIsMutating({ mutationKey, exact: true });
  // 요청 도중 계정이 바뀌면 이전 회원의 결제 결과를 표시하지 않는다.
  const current = (member: MemberSession) => client.getQueryData(["me"]) === member;
  const mutation = useMutation({
    mutationKey,
    retry: false,
    mutationFn: async ({ member, checkOnly }: Input) => {
      if (!current(member)) return null;
      let payment;
      if (!checkOnly) {
        // 첫 요청과 재요청 모두 주문에 연결된 같은 결제 정보를 받는다.
        payment = await preparation.submit(true);
        if (!current(member)) return null;
      }
      setPhase("verify");
      // 결제창을 열기 전에 서버에서 기존 결제 상태를 확인한다.
      const verification = await verifyPayment(orderId, payment?.paymentId);
      if (!current(member)) return null;
      // 조회 전용 요청이나 재결제가 금지된 상태에서는 SDK를 호출하지 않는다.
      if (checkOnly || !verification.canRetry) {
        await client.invalidateQueries({ queryKey: ["orders"] });
        return current(member) ? verifiedPaymentResult(verification) : null;
      }
      setPhase("sdk");
      const result = await requestPayment(verification);
      if (!current(member)) return null;
      // 성공 응답과 이미 결제된 건 모두 서버 검증을 거쳐야 완료로 표시한다.
      if (result.status === "received" || ["PAYMENT_ALREADY_PAID", "PaymentAlreadyPaid"].includes(result.response?.code ?? "")) {
        setPhase("verify");
        const confirmed = await verifyPayment(orderId, verification.paymentId);
        if (!current(member)) return null;
        await client.invalidateQueries({ queryKey: ["orders"] });
        return current(member) ? verifiedPaymentResult(confirmed, result.response) : null;
      }
      return { ...result, paymentId: verification.paymentId };
    },
    onError: (error, { member }) => {
      if (current(member) && error instanceof ApiError && error.status === 401) {
        client.setQueryData(["me"], null);
        client.removeQueries({ queryKey: ["orders"] });
      }
    },
    onSettled: () => setPhase(null),
  });

  async function submit(checkOnly = false) {
    // 빠른 연속 클릭과 같은 주문의 중복 요청을 함께 막는다.
    if (submitting.current || client.isMutating({ mutationKey, exact: true }) > 0) return;
    const member = client.getQueryData<MemberSession | null>(["me"]);
    if (!member || member.id !== memberId || !Number.isSafeInteger(orderId) || orderId <= 0) return;
    submitting.current = true;
    try { await mutation.mutateAsync({ member, checkOnly }); }
    catch { /* 오류는 반환 상태로 표시한다. */ }
    finally { submitting.current = false; }
  }

  const visible = mutation.variables !== undefined && current(mutation.variables.member);
  return {
    submit,
    isPending: pending > 0 || mutation.isPending || preparation.isPending,
    isPreparing: preparation.isPending,
    isVerifying: phase === "verify",
    data: visible ? mutation.data?.verification ?? preparation.data : undefined,
    error: visible ? mutation.error : null,
    result: visible ? mutation.data : null,
  };
}
