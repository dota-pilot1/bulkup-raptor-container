"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MemberSession } from "@/entities/session";
import { ApiError } from "@/shared/api/client";
import { getAdminDeliveries, getAdminDelivery, getOrderDelivery } from "../api/deliveries";
import { deliveryKeys, deliveryStatuses, type DeliveryFilters } from "./delivery-types";

function useDeliveryAuthError(memberId: number | null, error: Error | null) {
  const client = useQueryClient();
  useEffect(() => {
    if (!(error instanceof ApiError) || error.status !== 401) return;
    if (client.getQueryData<MemberSession | null>(["me"])?.id !== memberId) return;
    client.setQueryData(["me"], null);
    void client.cancelQueries({ queryKey: deliveryKeys.all });
    client.removeQueries({ queryKey: deliveryKeys.all });
  }, [client, memberId, error]);
}
export function useAdminDeliveries(memberId: number | null, filters: DeliveryFilters) {
  const query = useQuery({
    queryKey: deliveryKeys.list(memberId, filters),
    queryFn: ({ signal }) => getAdminDeliveries(filters, signal),
    enabled: memberId !== null, retry: false, staleTime: 0, refetchOnWindowFocus: true,
  });
  useDeliveryAuthError(memberId, query.error);
  return query;
}
export function useDeliveryCounts(memberId: number | null) {
  const query = useQuery({
    queryKey: deliveryKeys.counts(memberId),
    queryFn: async ({ signal }) => {
      const pages = await Promise.all(deliveryStatuses.map(status => getAdminDeliveries({ status, search: "", page: 0, size: 1 }, signal)));
      return Object.fromEntries(deliveryStatuses.map((status, index) => [status, pages[index].totalElements])) as Record<(typeof deliveryStatuses)[number], number>;
    },
    enabled: memberId !== null, retry: false, staleTime: 0, refetchOnWindowFocus: true,
  });
  useDeliveryAuthError(memberId, query.error);
  return query;
}
export function useAdminDelivery(memberId: number | null, deliveryId: number) {
  const query = useQuery({
    queryKey: deliveryKeys.detail(memberId, deliveryId), queryFn: ({ signal }) => getAdminDelivery(deliveryId, signal),
    enabled: memberId !== null && Number.isSafeInteger(deliveryId) && deliveryId > 0,
    retry: false, staleTime: 0, refetchOnWindowFocus: true,
  });
  useDeliveryAuthError(memberId, query.error);
  return query;
}
export function useOrderDelivery(memberId: number | null, orderId: number, open: boolean) {
  const query = useQuery({
    queryKey: deliveryKeys.order(memberId, orderId), queryFn: ({ signal }) => getOrderDelivery(orderId, signal),
    enabled: open && memberId !== null && Number.isSafeInteger(orderId) && orderId > 0,
    retry: false, staleTime: 0, refetchOnWindowFocus: true,
  });
  useDeliveryAuthError(memberId, query.error);
  return query;
}
