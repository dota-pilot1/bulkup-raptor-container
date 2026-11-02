import { apiFetch } from "@/shared/api/client";

export function deleteCartItem(itemId: number) {
  return apiFetch<void>(`/api/cart/items/${itemId}`, { method: "DELETE" });
}
