"use client";

import { useRef } from "react";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MemberSession } from "@/entities/session";
import type { CartResponse } from "@/entities/cart/model/types";
import { cartMutationKey, cartMutationScope, cartQueryKey } from "@/entities/cart/model/query-keys";
import { getCart } from "@/entities/cart/api/get-cart";
import { orderQueryKey } from "@/entities/order/model/order-query-keys";
import { orderAmounts } from "@/entities/order/model/order-amounts";
import type { CreateOrderRequest } from "@/entities/order/model/order-types";
import { ApiError } from "@/shared/api/client";
import { useToast } from "@/shared/ui/toast";
import { createOrder } from "../api/create-order";
import { createOrderRequestSchema, type OrderForm } from "./order-form-schema";
import { readOrderAttempt, saveOrderAttempt } from "./order-attempt-store";

type Input = { request: CreateOrderRequest; member: MemberSession };
export function useCreateOrder() {
  const client = useQueryClient();
  const toast = useToast();
  const submitting = useRef(false);
  const pendingWrites = useIsMutating({ mutationKey: cartMutationKey });
  const current = (member: MemberSession) => client.getQueryData(["me"]) === member;

  async function refreshCart(member: MemberSession) {
    const queryKey = cartQueryKey(member.id);
    await client.cancelQueries({ queryKey });
    if (!current(member)) return;
    try {
      await client.fetchQuery({ queryKey, queryFn: ({ signal }) => getCart(signal), staleTime: 0, retry: false });
    } finally {
      if (!current(member)) client.removeQueries({ queryKey });
    }
  }

  const mutation = useMutation({
    mutationKey: cartMutationKey,
    scope: cartMutationScope,
    retry: false,
    mutationFn: ({ request, member }: Input) => {
      if (!current(member)) throw new Error("로그인 상태가 변경되었습니다.");
      return createOrder(request);
    },
    onSuccess: async (order, { member }) => {
      if (!current(member)) return;
      const queryKey = orderQueryKey(member.id, order.orderId);
      await client.cancelQueries({ queryKey });
      if (!current(member)) return;
      client.setQueryData(queryKey, order);
      void client.invalidateQueries({ queryKey: ["orders", member.id, "list"] }).catch(() => {});
      saveOrderAttempt(member.id, null);
      try { await refreshCart(member); }
      catch {
        if (current(member)) toast.error("주문은 생성되었습니다. 장바구니는 다시 확인해 주세요.");
      }
    },
    onError: async (error, { member }) => {
      if (!current(member)) return;
      if (error instanceof ApiError && error.status === 401) {
        client.setQueryData(["me"], null);
        client.removeQueries({ queryKey: ["cart"] });
        client.removeQueries({ queryKey: ["orders"] });
        toast.error("로그인이 만료되었습니다. 다시 로그인한 뒤 주문 결과를 확인해 주세요.");
        return;
      }
      // 확정적으로 거부된 요청만 해제한다. 응답 유실·5xx·요청 ID 충돌은 그대로 보관한다.
      const rejected = error instanceof ApiError &&
        ([400, 403, 404].includes(error.status) || (error.status === 409 && error.code === "ORDER_AMOUNT_CHANGED"));
      if (rejected) saveOrderAttempt(member.id, null);
      toast.error(rejected && error instanceof ApiError ? error.message
        : "주문 결과를 확인하지 못했습니다. 같은 주문 요청으로 다시 확인해 주세요.");
      if (rejected) {
        try { await refreshCart(member); } catch { /* 화면에서 다시 조회할 수 있다. */ }
      }
    },
  });

  async function send(request: CreateOrderRequest, member: MemberSession) {
    if (submitting.current || client.isMutating({ mutationKey: cartMutationKey }) > 0) return null;
    submitting.current = true;
    saveOrderAttempt(member.id, request);
    try {
      const order = await mutation.mutateAsync({ request, member });
      return current(member) ? order : null;
    } catch { return null; }
    finally { submitting.current = false; }
  }

  async function submit(form: OrderForm, cart: CartResponse) {
    const member = client.getQueryData<MemberSession | null>(["me"]);
    if (!member) { toast.error("로그인 후 주문해 주세요."); return null; }
    const existing = readOrderAttempt(member.id);
    if (existing) return send(existing, member);
    const parsed = createOrderRequestSchema.safeParse({
      ...form, cartItemIds: cart.items.map(item => item.id).sort((a, b) => a - b),
      expectedTotalAmount: orderAmounts(cart.totalAmount).totalAmount,
      requestId: crypto.randomUUID(),
    });
    if (!parsed.success) { toast.error("배송지와 주문 상품을 다시 확인해 주세요."); return null; }
    return send(parsed.data, member);
  }

  async function retry() {
    const member = client.getQueryData<MemberSession | null>(["me"]);
    const request = member ? readOrderAttempt(member.id) : null;
    return member && request ? send(request, member) : null;
  }
  return { submit, retry, isPending: mutation.isPending || pendingWrites > 0 };
}
