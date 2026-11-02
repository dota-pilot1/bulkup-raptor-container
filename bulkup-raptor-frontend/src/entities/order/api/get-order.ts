import { apiFetch } from "@/shared/api/client";
import type { OrderResponse } from "../model/order-types";

export function getOrder(orderId: number, signal?: AbortSignal) {
  return apiFetch<OrderResponse>(`/api/orders/${orderId}`, { signal });
}
