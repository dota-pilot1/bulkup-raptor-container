"use client";

import { useRef } from "react";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MemberSession } from "@/entities/session";
import { cartMutationKey, cartMutationScope, cartQueryKey } from "@/entities/cart/model/query-keys";
import { getCart } from "@/entities/cart/api/get-cart";
import { ApiError } from "@/shared/api/client";
import { useToast } from "@/shared/ui/toast";
import { updateCartItemQuantity } from "../api/update-cart-item-quantity";

type UpdateInput = { itemId: number; quantity: number; member: MemberSession };

export function useUpdateCartItemQuantity() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const updating = useRef(false);
  const pendingWrites = useIsMutating({ mutationKey: cartMutationKey });
  const isCurrentSession = (snapshot: MemberSession) =>
    queryClient.getQueryData<MemberSession | null>(["me"]) === snapshot;

  const mutation = useMutation({
    mutationKey: cartMutationKey,
    // 연속 클릭 차단과 별도로, 드문 담기 요청과의 겹침에 대비해 공통 순서를 사용한다.
    scope: cartMutationScope,
    retry: false,
    mutationFn: ({ itemId, quantity, member: snapshot }: UpdateInput) => {
      if (!isCurrentSession(snapshot)) throw new Error("로그인 상태가 변경되었습니다. 다시 시도해 주세요.");
      return updateCartItemQuantity(itemId, quantity);
    },
    onSuccess: async (cart, { member: snapshot }) => {
      if (!isCurrentSession(snapshot)) return;
      const queryKey = cartQueryKey(snapshot.id);
      await queryClient.cancelQueries({ queryKey });
      if (!isCurrentSession(snapshot)) return;
      // PATCH가 반환한 저장 결과로 갱신하므로 성공 직후 GET은 다시 요청하지 않는다.
      queryClient.setQueryData(queryKey, cart);
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
          if (!isCurrentSession(snapshot)) queryClient.removeQueries({ queryKey });
        } catch {
          // 조회 실패는 기존 장바구니 오류 화면의 '다시 시도'로 복구한다.
        }
      }
    },
  });

  async function update(itemId: number, quantity: number) {
    // React 상태 반영 전의 연속 클릭과 다른 장바구니 변경 중 요청을 함께 막는다.
    if (updating.current || queryClient.isMutating({ mutationKey: cartMutationKey }) > 0) return;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      toast.error("상품 수량은 1개 이상 99개 이하의 정수여야 합니다.");
      return;
    }
    const snapshot = queryClient.getQueryData<MemberSession | null>(["me"]);
    if (!snapshot) {
      toast.error("로그인 후 수량을 변경해 주세요.");
      return;
    }
    updating.current = true;
    try {
      await mutation.mutateAsync({ itemId, quantity, member: snapshot });
    } catch {
      // 오류 안내와 필요한 재조회는 onError에서 처리한다.
    } finally {
      updating.current = false;
    }
  }

  return { update, isPending: mutation.isPending || pendingWrites > 0 };
}
