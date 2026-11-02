"use client";

import { useQuery } from "@tanstack/react-query";
import { getCart } from "../api/get-cart";
import { cartQueryKey } from "./query-keys";

export function useCart(memberId: number | null) {
  return useQuery({
    queryKey: cartQueryKey(memberId),
    queryFn: ({ signal }) => getCart(signal),
    enabled: memberId !== null,
    retry: false,
  });
}
