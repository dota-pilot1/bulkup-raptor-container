"use client";

import { useRef } from "react";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MemberSession } from "@/entities/session";
import { canHandleDelivery } from "@/entities/session";
import { ApiError } from "@/shared/api/client";
import { changeDeliveryStatus } from "@/entities/delivery/api/deliveries";
import { deliveryKeys, type DeliveryStatus } from "@/entities/delivery/model/delivery-types";

type Change = { status: DeliveryStatus; expectedVersion: number; reason: string };
export function useChangeDeliveryStatus(memberId: number, deliveryId: number) {
  const client = useQueryClient();
  const submitting = useRef(false);
  const mutationKey = ["change-delivery-status", memberId, deliveryId];
  const pending = useIsMutating({ mutationKey, exact: true });
  const current = () => {
    const member = client.getQueryData<MemberSession | null>(["me"]);
    return member?.id === memberId && canHandleDelivery(member);
  };
  const mutation = useMutation({
    mutationKey, retry: false,
    mutationFn: (change: Change) => {
      if (!current()) throw new Error("배송 변경 권한과 로그인 상태를 확인해 주세요.");
      return changeDeliveryStatus(deliveryId, change.status, change.expectedVersion, change.reason);
    },
    onSuccess: async result => {
      if (!current()) return;
      // Stop an older detail read before applying the confirmed write response.
      await client.cancelQueries({ queryKey: deliveryKeys.member(memberId) });
      if (!current()) return;
      client.setQueryData(deliveryKeys.detail(memberId, deliveryId), result);
      await client.invalidateQueries({ queryKey: deliveryKeys.member(memberId) });
    },
    onError: async error => {
      if (!current()) return;
      if (error instanceof ApiError && error.status === 401) {
        client.setQueryData(["me"], null);
        await client.cancelQueries({ queryKey: deliveryKeys.all });
        client.removeQueries({ queryKey: deliveryKeys.all });
      } else {
        // A conflict or lost response requires a fresh read, never an automatic resubmission.
        await client.invalidateQueries({ queryKey: deliveryKeys.member(memberId) });
        if (error instanceof ApiError && error.status === 403) void client.invalidateQueries({ queryKey: ["me"] });
      }
    },
  });
  async function submit(change: Change) {
    if (submitting.current || client.isMutating({ mutationKey, exact: true }) > 0 || !current()) return;
    submitting.current = true;
    try { await mutation.mutateAsync(change); }
    catch { /* The component displays the error and refreshed data. */ }
    finally { submitting.current = false; }
  }
  return { submit, reset: mutation.reset, isPending: pending > 0 || mutation.isPending,
    error: current() ? mutation.error : null, isSuccess: current() && mutation.isSuccess };
}
