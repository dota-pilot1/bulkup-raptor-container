import { apiFetch } from "@/shared/api/client";
import type { OrderPage } from "../model/order-types";

export function getOrders(page = 0, signal?: AbortSignal) {
  return apiFetch<OrderPage>(`/api/orders?page=${page}&size=20`, { signal });
}
