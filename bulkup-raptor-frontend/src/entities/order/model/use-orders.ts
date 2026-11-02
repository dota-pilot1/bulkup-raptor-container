"use client";

import { useQuery } from "@tanstack/react-query";
import { getOrders } from "../api/get-orders";
import { orderListKey } from "./order-query-keys";

export function useOrders(memberId: number | null, page = 0) {
  return useQuery({
    queryKey: orderListKey(memberId, page),
    queryFn: ({ signal }) => getOrders(page, signal),
    enabled: memberId !== null && Number.isSafeInteger(page) && page >= 0,
    retry: false,
  });
}
