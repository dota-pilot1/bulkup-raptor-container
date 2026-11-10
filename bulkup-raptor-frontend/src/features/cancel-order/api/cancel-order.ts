import { z } from "zod";
import { apiFetch } from "@/shared/api/client";

const resultSchema = z.object({
  orderId: z.number().int().positive(),
  orderStatus: z.enum(["CREATED", "PAID", "CANCELLED"]),
  inventoryStatus: z.enum(["LEGACY", "NOT_RESERVED", "RESERVED", "CONFIRMED", "RELEASE_PENDING", "RELEASED", "REVIEW_REQUIRED"]),
  pending: z.boolean(),
});

const orderCancellationSchema = resultSchema.refine(value => value.pending
  ? (value.orderStatus === "CREATED" && ["RESERVED", "RELEASE_PENDING", "REVIEW_REQUIRED"].includes(value.inventoryStatus))
    || (value.orderStatus === "PAID" && ["LEGACY", "CONFIRMED"].includes(value.inventoryStatus))
  : (value.orderStatus === "CANCELLED" && ["LEGACY", "NOT_RESERVED", "RELEASED"].includes(value.inventoryStatus))
    || (value.orderStatus === "PAID" && ["LEGACY", "CONFIRMED"].includes(value.inventoryStatus)));

export type CancellationResult = z.infer<typeof resultSchema>;

const bulkResultSchema = z.object({
  results: z.array(z.object({
    orderId: z.number().int().positive(),
    succeeded: z.boolean(),
    orderStatus: z.enum(["CREATED", "PAID", "CANCELLED"]).nullable().optional(),
    pending: z.boolean().nullable().optional(),
    code: z.string().nullable().optional(),
    message: z.string().nullable().optional(),
  })).max(50),
});

export type BulkCancellationResult = z.infer<typeof bulkResultSchema>;

export async function cancelOrders(orderIds: number[], reason?: string): Promise<BulkCancellationResult> {
  const ids = [...new Set(orderIds)];
  const trimmed = reason?.trim();
  if (ids.length < 1 || ids.length > 50 || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error("취소할 주문을 다시 선택해 주세요.");
  }
  if (trimmed && trimmed.length > 200) throw new Error("취소 사유는 200자 이내로 입력해 주세요.");
  const result = bulkResultSchema.safeParse(await apiFetch<unknown>("/api/admin/orders/cancellations", {
    method: "POST",
    body: JSON.stringify({ orderIds: ids, ...(trimmed ? { reason: trimmed } : {}) }),
  }));
  const returned = result.success ? result.data.results.map(item => item.orderId) : [];
  if (!result.success || ids.some(id => !returned.includes(id))) {
    throw new Error("선택 취소 결과를 확인하지 못했습니다. 주문 상태를 다시 확인해 주세요.");
  }
  return result.data;
}

export async function cancelOrder(orderId: number, releaseOnly = false, reason?: string, admin = false): Promise<CancellationResult> {
  const action = releaseOnly ? "release-reservation" : "cancel";
  const schema = releaseOnly ? resultSchema : orderCancellationSchema;
  const trimmed = releaseOnly ? undefined : reason?.trim();
  if (trimmed && trimmed.length > 200) throw new Error("취소 사유는 200자 이내로 입력해 주세요.");
  const path = admin ? `/api/admin/orders/${orderId}/cancel` : `/api/orders/${orderId}/payments/${action}`;
  const result = schema.safeParse(await apiFetch<unknown>(path, {
    method: "POST", ...(trimmed ? { body: JSON.stringify({ reason: trimmed }) } : {}),
  }));
  if (!result.success || result.data.orderId !== orderId) {
    throw new Error("취소 결과를 확인하지 못했습니다. 주문 상태를 다시 확인해 주세요.");
  }
  return result.data;
}
