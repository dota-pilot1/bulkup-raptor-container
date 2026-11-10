import { z } from "zod";
import type { StockAdjustmentRequest } from "@/entities/inventory/model/stock-adjustment";

export type StockDirection = "increase" | "decrease";
export type StockAdjustmentFieldErrors = Partial<Record<"quantity" | "reason", string>>;
export const MAX_STOCK = 2_147_483_647;

export function createStockAdjustmentSchema(currentStock: number) {
  return z.object({
    direction: z.enum(["increase", "decrease"]),
    quantity: z.string()
      .regex(/^\d+$/, "변경 수량은 1 이상의 정수로 입력해 주세요.")
      .refine((value) => !/^\d+$/.test(value)
        || (Number.isSafeInteger(Number(value)) && Number(value) >= 1 && Number(value) <= MAX_STOCK),
      "변경 수량은 1개 이상 2,147,483,647개 이하로 입력해 주세요."),
    reason: z.string().trim()
      .min(1, "변경 사유는 1자 이상 입력해 주세요.")
      .max(200, "변경 사유는 200자 이하로 입력해 주세요."),
  }).superRefine(({ direction, quantity }, context) => {
    const amount = Number(quantity);
    if (!/^\d+$/.test(quantity) || !Number.isSafeInteger(amount) || amount < 1 || amount > MAX_STOCK) return;
    const afterQuantity = currentStock + (direction === "increase" ? amount : -amount);
    if (afterQuantity < 0) {
      context.addIssue({ code: "custom", path: ["quantity"], message: "현재 재고보다 많이 줄일 수 없습니다." });
    } else if (afterQuantity > MAX_STOCK) {
      context.addIssue({ code: "custom", path: ["quantity"], message: "변경 후 재고는 2,147,483,647개를 넘을 수 없습니다." });
    }
  });
}

export type StockAdjustmentFormValues = z.infer<ReturnType<typeof createStockAdjustmentSchema>>;
export type StockAdjustmentValidation =
  | { valid: true; request: StockAdjustmentRequest; afterQuantity: number }
  | { valid: false; message: string; fieldErrors: StockAdjustmentFieldErrors };

export function validateStockAdjustment(
  direction: StockDirection, quantity: string, reason: string, currentStock: number,
): StockAdjustmentValidation {
  const result = createStockAdjustmentSchema(currentStock).safeParse({ direction, quantity, reason });
  if (!result.success) {
    const fieldErrors: StockAdjustmentFieldErrors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (field === "quantity" || field === "reason") fieldErrors[field] ??= issue.message;
    }
    return { valid: false, message: fieldErrors.quantity ?? fieldErrors.reason ?? "입력값을 확인해 주세요.", fieldErrors };
  }
  const delta = result.data.direction === "increase" ? Number(result.data.quantity) : -Number(result.data.quantity);
  return { valid: true, request: { delta, reason: result.data.reason }, afterQuantity: currentStock + delta };
}
