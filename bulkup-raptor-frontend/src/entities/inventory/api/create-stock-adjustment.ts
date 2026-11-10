import { apiFetch } from "@/shared/api/client";
import type { StockAdjustment, StockAdjustmentRequest } from "../model/stock-adjustment";

export function createStockAdjustment(productId: number, request: StockAdjustmentRequest) {
  return apiFetch<StockAdjustment>(`/api/admin/products/${productId}/stock-adjustments`, {
    method: "POST",
    body: JSON.stringify({ delta: request.delta, reason: request.reason }),
    signal: AbortSignal.timeout(15_000),
  });
}
