"use client";

import { useRef } from "react";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MemberSession } from "@/entities/session";
import { ApiError } from "@/shared/api/client";
import { preparePayment } from "../api/prepare-payment";

type Input = { member: MemberSession };

export function usePreparePayment(memberId: number, orderId: number) {
  const client = useQueryClient();
  const submitting = useRef(false);
  const mutationKey = ["prepare-payment", memberId, orderId];
  const pending = useIsMutating({ mutationKey, exact: true });
  const current = (member: MemberSession) => client.getQueryData(["me"]) === member;
  const mutation = useMutation({
    mutationKey,
    retry: false,
    mutationFn: ({ member }: Input) => {
      if (!current(member)) throw new Error("로그인 상태가 변경되었습니다.");
      return preparePayment(orderId);
    },
    onError: (error, { member }) => {
      if (current(member) && error instanceof ApiError && error.status === 401) {
        client.setQueryData(["me"], null);
        client.removeQueries({ queryKey: ["orders"] });
      }
    },
  });

  async function submit(throwOnError = false) {
    if (submitting.current || client.isMutating({ mutationKey, exact: true }) > 0) return null;
    const member = client.getQueryData<MemberSession | null>(["me"]);
    if (!member || member.id !== memberId || !Number.isSafeInteger(orderId) || orderId <= 0) return null;
    submitting.current = true;
    try {
      const result = await mutation.mutateAsync({ member });
      return current(member) ? result : null;
    } catch (error) { if (throwOnError) throw error; return null; }
    finally { submitting.current = false; }
  }

  const visible = mutation.variables !== undefined && current(mutation.variables.member);
  return {
    submit,
    isPending: pending > 0 || mutation.isPending,
    data: visible ? mutation.data : undefined,
    error: visible ? mutation.error : null,
  };
}
