import { z } from "zod";

export const deliveryStatuses = ["PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"] as const;
export type DeliveryStatus = (typeof deliveryStatuses)[number];
export const deliveryLabels: Record<DeliveryStatus, string> = {
  PREPARING: "배송 준비 중", OUT_FOR_DELIVERY: "배송 중", DELIVERED: "전달 완료",
};
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const version = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const time = z.string().datetime({ offset: true });
const item = z.object({ productName: z.string(), quantity: z.number().int().positive() });
const summary = z.object({
  deliveryId: id, orderId: id, status: z.enum(deliveryStatuses), version,
  recipientName: z.string(), phone: z.string(), postalCode: z.string(), address: z.string(), addressDetail: z.string(),
  createdAt: time, startedAt: time.nullable(), deliveredAt: time.nullable(),
  items: z.array(item),
  cancellationPending: z.boolean().optional(),
});
export const deliveryInfoSchema = summary.extend({
  handlerName: z.string().nullable().optional(),
  centerName: z.string().nullable(), pickupLocation: z.string().nullable(), scheduledAt: time.nullable(),
});
const publicHistory = z.object({ fromStatus: z.enum(deliveryStatuses), toStatus: z.enum(deliveryStatuses), createdAt: time });
export const adminDeliverySchema = z.object({
  delivery: deliveryInfoSchema,
  history: z.array(publicHistory.extend({ id, actorId: id.nullable(), actorName: z.string().nullable().optional(), reason: z.string().nullable() })),
});
// The public shape also strips unexpected internal fields from a response.
export const orderDeliverySchema = z.object({ delivery: deliveryInfoSchema, history: z.array(publicHistory) });
export const deliveryPageSchema = z.object({
  content: z.array(summary), page: z.number().int().nonnegative(), size: z.number().int().min(1).max(100),
  totalPages: z.number().int().nonnegative(), totalElements: z.number().int().nonnegative(),
});
export type DeliveryInfo = z.infer<typeof deliveryInfoSchema>;
export type DeliverySummary = z.infer<typeof summary>;
export type AdminDelivery = z.infer<typeof adminDeliverySchema>;
export type OrderDelivery = z.infer<typeof orderDeliverySchema>;
export type DeliveryPage = z.infer<typeof deliveryPageSchema>;
export type DeliveryHistory = OrderDelivery["history"][number] | AdminDelivery["history"][number];
export type DeliveryFilters = { status: DeliveryStatus; search: string; page: number; size: number };

export const deliveryKeys = {
  all: ["deliveries"] as const,
  member: (memberId: number | null) => ["deliveries", memberId] as const,
  list: (memberId: number | null, filters: DeliveryFilters) => ["deliveries", memberId, "admin", "list", filters] as const,
  counts: (memberId: number | null) => ["deliveries", memberId, "admin", "counts"] as const,
  detail: (memberId: number | null, deliveryId: number) => ["deliveries", memberId, "admin", "detail", deliveryId] as const,
  order: (memberId: number | null, orderId: number) => ["deliveries", memberId, "order", orderId] as const,
};
