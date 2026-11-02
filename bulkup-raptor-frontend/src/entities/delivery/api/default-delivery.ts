import { apiFetch } from "@/shared/api/client";
import type { DeliveryInfo } from "../model/schema";

export const defaultDeliveryKey = (memberId: number) => ["default-delivery", memberId] as const;
export async function getDefaultDelivery(signal?: AbortSignal): Promise<DeliveryInfo | null> {
  return await apiFetch<DeliveryInfo | undefined>("/api/auth/me/default-delivery", { signal }) ?? null;
}
export function saveDefaultDelivery(delivery: DeliveryInfo) {
  return apiFetch<DeliveryInfo>("/api/auth/me/default-delivery", { method: "PUT", body: JSON.stringify(delivery) });
}
