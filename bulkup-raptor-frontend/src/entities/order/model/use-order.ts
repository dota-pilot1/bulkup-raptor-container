"use client";

import { useQuery } from "@tanstack/react-query";
import { getOrder } from "../api/get-order";
import { orderQueryKey } from "./order-query-keys";

export function useOrder(memberId: number | null, orderId: number) {
  return useQuery({
    queryKey: orderQueryKey(memberId, orderId),
    queryFn: ({ signal }) => getOrder(orderId, signal),
    enabled: memberId !== null && Number.isSafeInteger(orderId) && orderId > 0,
    retry: false,
    refetchInterval: query => query.state.data?.cancellationPending ? 10_000 : false,
  });
}
