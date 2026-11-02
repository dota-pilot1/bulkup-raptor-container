"use client";

import { useRef } from "react";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MemberSession } from "@/entities/session";
import { cartMutationKey, cartMutationScope, cartQueryKey } from "@/entities/cart/model/query-keys";
import { getCart } from "@/entities/cart/api/get-cart";
import { ApiError } from "@/shared/api/client";
import { useToast } from "@/shared/ui/toast";
import { deleteCartItem } from "../api/delete-cart-item";

type DeleteInput = { itemId: number; member: MemberSession };

export function useDeleteCartItem() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const deleting = useRef(false);
  const pendingWrites = useIsMutating({ mutationKey: cartMutationKey });
  const isCurrentSession = (snapshot: MemberSession) =>
    queryClient.getQueryData<MemberSession | null>(["me"]) === snapshot;

  const mutation = useMutation({
    mutationKey: cartMutationKey,
    // 담기·수량 변경과 삭제 후 재조회까지 같은 순서로 처리한다.
    scope: cartMutationScope,
    retry: false,
    mutationFn: ({ itemId, member: snapshot }: DeleteInput) => {
      if (!isCurrentSession(snapshot)) throw new Error("로그인 상태가 변경되었습니다. 다시 시도해 주세요.");
      return deleteCartItem(itemId);
    },
    onSuccess: async (_result, { member: snapshot }) => {
      if (!isCurrentSession(snapshot)) return;
      try {
        await refresh(snapshot);
      } catch {
        if (!isCurrentSession(snapshot)) return;
        toast.error("삭제되었습니다. 장바구니를 다시 불러오지 못했습니다. 다시 시도해 주세요.");
      }
    },
    onError: async (error, { member: snapshot }) => {
      if (!isCurrentSession(snapshot)) return;
      if (error instanceof ApiError && error.status === 401) {
        queryClient.setQueryData(["me"], null);
        queryClient.removeQueries({ queryKey: ["cart"] });
        toast.error("로그인이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      toast.error(error instanceof ApiError ? error.message
        : "통신 오류가 발생했습니다. 저장된 장바구니를 다시 확인합니다.");
      // 항목 삭제 또는 응답 유실이면 저장 결과를 조회해 화면과 서버를 다시 맞춘다.
      if (!(error instanceof ApiError) || error.status === 404 || error.status >= 500) {
        try {
          await refresh(snapshot);
        } catch {
          // 조회 오류 화면의 '다시 시도'로 복구한다.
        }
      }
    },
  });

  async function refresh(snapshot: MemberSession) {
    const queryKey = cartQueryKey(snapshot.id);
    await queryClient.cancelQueries({ queryKey });
    if (!isCurrentSession(snapshot)) return;
    try {
      await queryClient.fetchQuery({
        queryKey,
        queryFn: ({ signal }) => getCart(signal),
        staleTime: 0,
        retry: false,
      });
    } finally {
      if (!isCurrentSession(snapshot)) queryClient.removeQueries({ queryKey });
    }
  }

  async function remove(itemId: number) {
    if (deleting.current || queryClient.isMutating({ mutationKey: cartMutationKey }) > 0) return;
    const snapshot = queryClient.getQueryData<MemberSession | null>(["me"]);
    if (!snapshot) {
      toast.error("로그인 후 상품을 삭제해 주세요.");
      return;
    }
    deleting.current = true;
    try {
      await mutation.mutateAsync({ itemId, member: snapshot });
    } catch {
      // 오류 안내와 필요한 재조회는 onError에서 처리한다.
    } finally {
      deleting.current = false;
    }
  }

  return { remove, isPending: mutation.isPending || pendingWrites > 0 };
}
