import { apiFetch } from "@/shared/api/client";
import type { StockAdjustmentPage } from "../model/stock-adjustment";

export function getStockAdjustments(productId: number, page: number, size: number, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return apiFetch<StockAdjustmentPage>(`/api/admin/products/${productId}/stock-adjustments?${params}`, { signal });
}
