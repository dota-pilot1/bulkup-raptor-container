import { apiFetch } from "@/shared/api/client";
import { preparedPaymentSchema } from "../model/payment-types";

export async function preparePayment(orderId: number) {
  const response = await apiFetch<unknown>(`/api/orders/${orderId}/payments`, {
    method: "POST",
  });
  const parsed = preparedPaymentSchema.safeParse(response);
  if (!parsed.success) throw new Error("결제 정보를 확인하지 못했습니다. 다시 시도해 주세요.");
  return parsed.data;
}
