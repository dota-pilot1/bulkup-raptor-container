import { z } from "zod";
import { apiFetch } from "@/shared/api/client";
import { adminDeliverySchema, deliveryPageSchema, orderDeliverySchema, type DeliveryFilters, type DeliveryStatus } from "../model/delivery-types";

function validId(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("올바른 주문·배송 번호가 필요합니다.");
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error("배송 응답을 읽지 못했습니다. 다시 조회해 주세요.");
  return result.data;
}
export async function getAdminDeliveries(filters: DeliveryFilters, signal?: AbortSignal) {
  const query = new URLSearchParams({ page: String(filters.page), size: String(filters.size), status: filters.status, search: filters.search });
  return parse(deliveryPageSchema, await apiFetch<unknown>(`/api/admin/deliveries?${query}`, { signal }));
}
export async function getAdminDelivery(deliveryId: number, signal?: AbortSignal) {
  validId(deliveryId);
  const result = parse(adminDeliverySchema, await apiFetch<unknown>(`/api/admin/deliveries/${deliveryId}`, { signal }));
  if (result.delivery.deliveryId !== deliveryId) throw new Error("조회한 배송 번호가 일치하지 않습니다.");
  return result;
}
export async function getOrderDelivery(orderId: number, signal?: AbortSignal) {
  validId(orderId);
  const result = parse(orderDeliverySchema, await apiFetch<unknown>(`/api/orders/${orderId}/delivery`, { signal }));
  if (result.delivery.orderId !== orderId) throw new Error("조회한 주문 번호가 일치하지 않습니다.");
  return result;
}
export async function changeDeliveryStatus(deliveryId: number, status: DeliveryStatus, expectedVersion: number, reason: string) {
  validId(deliveryId);
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0 || reason.length > 500) throw new Error("배송 변경 정보를 확인해 주세요.");
  const result = parse(adminDeliverySchema, await apiFetch<unknown>(`/api/admin/deliveries/${deliveryId}/status`, {
    method: "PATCH", body: JSON.stringify({ status, expectedVersion, reason: reason.trim() || null }),
  }));
  if (result.delivery.deliveryId !== deliveryId || result.delivery.status !== status) throw new Error("배송 변경 결과를 다시 조회해 주세요.");
  return result;
}
