import { apiFetch } from "@/shared/api/client";
import type { CreateOrderRequest, OrderResponse } from "@/entities/order/model/order-types";

export function createOrder(request: CreateOrderRequest) {
  return apiFetch<OrderResponse>("/api/orders", {
    method: "POST",
    body: JSON.stringify(request),
  });
}
