import type { Product } from "../model/product";
import { apiFetch } from "@/shared/api/client";

export function getProduct(id: number, signal?: AbortSignal) {
  return apiFetch<Product>(`/api/products/${id}`, { signal });
}
