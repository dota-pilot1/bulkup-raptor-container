import { apiFetch } from "@/shared/api/client";
import type { CartResponse } from "@/entities/cart/model/types";

export function updateCartItemQuantity(itemId: number, quantity: number) {
  return apiFetch<CartResponse>(`/api/cart/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  });
}
