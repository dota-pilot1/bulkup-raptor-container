import { apiFetch } from "@/shared/api/client";
import type { OrderResponse, OrderSummary } from "../model/order-types";
import type { AdminPayment } from "@/entities/payment/api/get-admin-payments";

export type AdminOrderBuyer = { memberId: number; name: string; email: string };
export type AdminOrderSummary = OrderSummary & { buyer: AdminOrderBuyer; cancellationReason?: string | null };
export type AdminOrderPage = { content: AdminOrderSummary[]; page: number; size: number; totalPages: number; totalElements: number };
export type AdminOrderDetail = { buyer: AdminOrderBuyer; order: OrderResponse; payment: AdminPayment | null };
export type AdminOrderFilters = { search: string; status: "ALL" | OrderResponse["status"] };

export function getAdminOrders(params: AdminOrderFilters & { page: number; size: number }, signal?: AbortSignal) {
  const query = new URLSearchParams({ page: String(params.page), size: String(params.size), search: params.search });
  if (params.status === "CANCELLABLE") query.set("cancellable", "true");
  else if (params.status !== "ALL") query.set("status", params.status);
  return apiFetch<AdminOrderPage>(`/api/admin/orders?${query}`, { signal });
}

export function getAdminOrder(orderId: number, signal?: AbortSignal) {
  return apiFetch<AdminOrderDetail>(`/api/admin/orders/${orderId}`, { signal });
}

export async function getAdminOrderCounts(search = "", signal?: AbortSignal) {
  const [created, paid, cancelled, cancellable] = await Promise.all(
    (["CREATED", "PAID", "CANCELLED", "CANCELLABLE"] as const)
      .map(status => getAdminOrders({ page: 0, size: 1, search, status }, signal)));
  return { CREATED: created.totalElements, PAID: paid.totalElements, CANCELLED: cancelled.totalElements,
    CANCELLABLE: cancellable.totalElements,
    ALL: created.totalElements + paid.totalElements + cancelled.totalElements };
}
