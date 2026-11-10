import { apiFetch } from "@/shared/api/client";
import type { OrderPage, OrderFilter, OrderStatus } from "../model/order-types";

export function getOrders(page = 0, signal?: AbortSignal, status: OrderFilter = "ALL", size = 20) {
  return apiFetch<OrderPage>(`/api/orders?page=${page}&size=${size}${status === "ALL" ? "" : `&status=${encodeURIComponent(status)}`}`, { signal });
}

export type OrderCounts = Record<OrderFilter, number>;

export async function getOrderCounts(signal?: AbortSignal): Promise<OrderCounts> {
  const statuses: OrderStatus[] = ["CREATED", "PAID", "CANCELLED"];
  const pages = await Promise.all(statuses.map(status => getOrders(0, signal, status, 1)));
  const [created, paid, cancelled] = pages.map(page => page.totalElements);
  return { CREATED: created, PAID: paid, CANCELLED: cancelled, ALL: created + paid + cancelled };
}
