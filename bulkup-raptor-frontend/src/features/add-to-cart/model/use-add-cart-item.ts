"use client";

import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MemberSession } from "@/entities/session";
import { cartMutationKey, cartMutationScope, cartQueryKey } from "@/entities/cart/model/query-keys";
import { currentMember } from "@/lib/api";
import { ApiError } from "@/shared/api/client";
import { useToast } from "@/shared/ui/toast";
import { addCartItem } from "../api/add-cart-item";

type AddInput = { productId: number; quantity: number; member: MemberSession };

export function useAddCartItem() {
  const queryClient = useQueryClient();
  const member = useQuery({ queryKey: ["me"], queryFn: currentMember });
  const toast = useToast();
  const adding = useRef(false);
  const isCurrentSession = (snapshot: MemberSession) =>
    queryClient.getQueryData<MemberSession | null>(["me"]) === snapshot;

  const mutation = useMutation({
    mutationKey: cartMutationKey,
    // 여러 상품 카드의 담기를 순서대로 처리하고, 드문 수량 변경 요청과의 겹침에도 대비한다.
    scope: cartMutationScope,
    retry: false,
    mutationFn: ({ productId, quantity, member: snapshot }: AddInput) => {
      if (!isCurrentSession(snapshot)) throw new Error("로그인 상태가 변경되었습니다. 다시 시도해 주세요.");
      return addCartItem(productId, quantity);
    },
    onSuccess: async (cart, { member: snapshot }) => {
      if (!isCurrentSession(snapshot)) return;
      const queryKey = cartQueryKey(snapshot.id);
      await queryClient.cancelQueries({ queryKey });
      if (!isCurrentSession(snapshot)) return;
      queryClient.setQueryData(queryKey, cart);
      toast.success("장바구니에 상품을 담았습니다.");
    },
    onError: (error, { member: snapshot }) => {
      if (!isCurrentSession(snapshot)) return;
      if (error instanceof ApiError && error.status === 401) {
        queryClient.setQueryData(["me"], null);
        queryClient.removeQueries({ queryKey: ["cart"] });
        toast.error("로그인이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }
      const message = error instanceof Error ? error.message : "상품을 담지 못했습니다.";
      toast.error(error instanceof ApiError ? message
        : `${message} 다시 담기 전에 장바구니 저장 여부를 확인해 주세요.`);
    },
  });

  async function add(productId: number, quantity = 1) {
    // 상태 갱신 전 같은 버튼의 연속 호출도 차단한다.
    if (adding.current) return;
    const snapshot = queryClient.getQueryData<MemberSession | null>(["me"]);
    if (member.isPending) return;
    if (member.isError) {
      toast.error("로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      return;
    }
    if (!snapshot) {
      toast.error("로그인 후 상품을 담아 주세요.");
      return;
    }
    adding.current = true;
    try {
      await mutation.mutateAsync({ productId, quantity, member: snapshot });
    } catch {
      // 실패 안내는 onError에서 처리한다.
    } finally {
      adding.current = false;
    }
  }

  return { add, isPending: mutation.isPending || member.isPending };
}
