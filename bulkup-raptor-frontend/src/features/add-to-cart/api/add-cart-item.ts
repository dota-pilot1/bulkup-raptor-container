import { apiFetch } from "@/shared/api/client";
import type { CartResponse } from "@/entities/cart/model/types";

export function addCartItem(productId: number) {
  return apiFetch<CartResponse>("/api/cart/items", {
    method: "POST",
    body: JSON.stringify({ productId, quantity: 1 }),
  });
}
