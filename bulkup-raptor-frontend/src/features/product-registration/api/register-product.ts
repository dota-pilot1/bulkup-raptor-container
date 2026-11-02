import type { Product, ProductInput } from "@/entities/product/model/product";
import { apiFetch } from "@/shared/api/client";

export type ProductRegistrationResponse = {
  product: Product;
  imageUploadError: string | null;
};

export function registerProduct(input: ProductInput, file: File | null) {
  const body = new FormData();
  body.append("product", new Blob([JSON.stringify(input)], { type: "application/json" }));
  if (file) body.append("file", file);
  return apiFetch<ProductRegistrationResponse>("/api/products", { method: "POST", body });
}
