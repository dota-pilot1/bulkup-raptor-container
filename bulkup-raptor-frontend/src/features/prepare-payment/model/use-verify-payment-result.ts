"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { currentMember } from "@/lib/api";
import { ApiError } from "@/shared/api/client";
import { verifyPayment } from "../api/verify-payment";

export function useVerifyPaymentResult(paymentId?: string) {
  const client = useQueryClient();
  const member = useQuery({ queryKey: ["me"], queryFn: currentMember });
  const verification = useQuery({
    queryKey: ["payment-verification", member.data?.id, paymentId],
    // 복귀 URL의 결제 ID만 믿지 않고, 로그인한 회원으로 서버 검증을 요청한다.
    enabled: !!member.data && !!paymentId,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const session = client.getQueryData(["me"]);
      try {
        const result = await verifyPayment(null, paymentId);
        // 계정이 바뀐 동안 도착한 응답은 현재 화면에서 사용하지 않는다.
        if (client.getQueryData(["me"]) !== session) throw new Error("로그인 상태가 변경되었습니다.");
        await client.invalidateQueries({ queryKey: ["orders"] });
        return result;
      } catch (error) {
        if (client.getQueryData(["me"]) === session && error instanceof ApiError && error.status === 401) {
          client.setQueryData(["me"], null);
          client.removeQueries({ queryKey: ["orders"] });
        }
        throw error;
      }
    },
  });
  return {
    memberId: member.data?.id ?? null,
    data: member.data ? verification.data : undefined,
    isChecking: member.isPending || verification.isFetching,
    needsLogin: member.data === null,
    error: member.error ?? verification.error,
    retry: () => member.isError ? member.refetch() : verification.refetch(),
  };
}
