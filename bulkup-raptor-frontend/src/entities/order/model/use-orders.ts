"use client";

import { useQuery } from "@tanstack/react-query";
import { getOrderCounts, getOrders } from "../api/get-orders";
import type { OrderFilter } from "./order-types";
import { orderCountsKey, orderListKey } from "./order-query-keys";

export function useOrders(memberId: number | null, page = 0, status: OrderFilter = "ALL") {
  return useQuery({
    queryKey: orderListKey(memberId, page, status),
    queryFn: ({ signal }) => getOrders(page, signal, status),
    enabled: memberId !== null && Number.isSafeInteger(page) && page >= 0,
    retry: false,
    refetchInterval: query => query.state.data?.content.some(order => order.cancellationPending) ? 10_000 : false,
  });
}

export function useOrderCounts(memberId: number | null, hasPendingCancellation = false) {
  return useQuery({
    queryKey: orderCountsKey(memberId),
    queryFn: ({ signal }) => getOrderCounts(signal),
    enabled: memberId !== null,
    retry: false,
    staleTime: 15_000,
    refetchInterval: hasPendingCancellation ? 10_000 : false,
  });
}
