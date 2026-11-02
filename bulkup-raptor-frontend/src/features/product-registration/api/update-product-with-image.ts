import type { Product, ProductInput } from "@/entities/product/model/product";
import { apiFetch } from "@/shared/api/client";

export function updateProductWithImage(id: number, input: ProductInput, file: File | null) {
  const body = new FormData();
  body.append("product", new Blob([JSON.stringify(input)], { type: "application/json" }));
  if (file) body.append("file", file);
  return apiFetch<Product>(`/api/products/${id}`, { method: "PUT", body });
}
