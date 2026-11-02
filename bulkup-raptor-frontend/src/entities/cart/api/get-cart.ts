import { apiFetch } from "@/shared/api/client";
import type { CartResponse } from "../model/types";

export function getCart(signal?: AbortSignal) {
  return apiFetch<CartResponse>("/api/cart", { signal });
}
