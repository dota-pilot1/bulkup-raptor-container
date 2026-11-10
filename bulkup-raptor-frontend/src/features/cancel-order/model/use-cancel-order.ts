"use client";

import { useRef } from "react";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MemberSession } from "@/entities/session";
import type { OrderResponse } from "@/entities/order/model/order-types";
import { orderQueryKey } from "@/entities/order/model/order-query-keys";
import { ApiError } from "@/shared/api/client";
import { cancelOrder } from "../api/cancel-order";

export function useCancelOrder(memberId: number, orderId: number, releaseOnly = false, admin = false) {
  const client = useQueryClient();
  const submitting = useRef(false);
  const mutationKey = ["cancel-order", memberId, orderId];
  const paymentKey = ["request-payment", memberId, orderId];
  const pending = useIsMutating({ mutationKey, exact: true });
  const paymentPending = useIsMutating({ mutationKey: paymentKey, exact: true });
  const current = (member: MemberSession) => client.getQueryData(["me"]) === member;
  const mutation = useMutation({
    mutationKey,
    retry: false,
    mutationFn: ({ member, reason }: { member: MemberSession; reason?: string }) => {
      if (!current(member)) throw new Error("로그인 상태가 변경되었습니다.");
      return cancelOrder(orderId, releaseOnly, reason, admin);
    },
    onSuccess: async (result, { member }) => {
      if (!current(member)) return;
      const queryKey = orderQueryKey(memberId, orderId);
      await client.cancelQueries({ queryKey });
      if (!current(member)) return;
      client.setQueryData<OrderResponse>(queryKey, order => order
        ? { ...order, status: result.orderStatus, inventoryStatus: result.inventoryStatus, cancellationPending: result.pending } : undefined);
      // 확정 응답은 즉시 표시하고, 상세·목록의 기존 조회 결과도 갱신한다.
      void client.invalidateQueries({ queryKey: ["orders", memberId] }).catch(() => {});
      void client.invalidateQueries({ queryKey: ["deliveries", memberId] }).catch(() => {});
      void client.invalidateQueries({ queryKey: ["admin-orders"] }).catch(() => {});
      void client.invalidateQueries({ queryKey: ["admin-order"] }).catch(() => {});
    },
    onError: (error, { member }) => {
      if (!current(member)) return;
      if (error instanceof ApiError && error.status === 401) {
        client.setQueryData(["me"], null);
        client.removeQueries({ queryKey: ["orders"] });
      } else {
        // 응답을 받지 못해도 서버에서는 취소됐을 수 있다.
        void client.invalidateQueries({ queryKey: ["orders", memberId] }).catch(() => {});
      }
    },
  });

  async function submit(reason?: string) {
    if (submitting.current || client.isMutating({ mutationKey, exact: true }) > 0
        || client.isMutating({ mutationKey: paymentKey, exact: true }) > 0) return;
    const member = client.getQueryData<MemberSession | null>(["me"]);
    if (!member || member.id !== memberId || !Number.isSafeInteger(orderId) || orderId <= 0) return;
    submitting.current = true;
    try { await mutation.mutateAsync({ member, ...(reason?.trim() ? { reason: reason.trim() } : {}) }); }
    catch { /* 오류는 다이얼로그에서 표시한다. */ }
    finally { submitting.current = false; }
  }

  const visible = mutation.variables !== undefined && current(mutation.variables.member);
  return {
    submit,
    isPending: pending > 0 || paymentPending > 0 || mutation.isPending,
    data: visible ? mutation.data : undefined,
    error: visible ? mutation.error : null,
  };
}
