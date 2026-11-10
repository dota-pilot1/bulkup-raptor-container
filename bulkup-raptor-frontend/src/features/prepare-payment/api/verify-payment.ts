import { z } from "zod";
import { apiFetch } from "@/shared/api/client";

// 완료 증빙과 상태 조합까지 검사해, 불완전한 응답을 완료 화면에 사용하지 않는다.
const verificationSchema = z.object({
  orderId: z.number().int().positive(),
  paymentId: z.string().min(1),
  orderName: z.string().min(1),
  totalAmount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  currency: z.literal("KRW"),
  paymentStatus: z.enum(["READY", "PAID", "CANCELLED"]),
  orderStatus: z.enum(["CREATED", "PAID", "CANCELLED"]),
  providerStatus: z.enum(["NOT_FOUND", "READY", "FAILED", "PENDING", "VIRTUAL_ACCOUNT_ISSUED", "PAID", "CANCELLED", "PARTIAL_CANCELLED"]),
  paidAt: z.string().datetime().nullable(),
  transactionId: z.string().nullable(),
  pgTxId: z.string().nullable(),
  paymentMethod: z.string().nullable(),
  canOpenPaymentWindow: z.boolean(),
}).refine(v => v.paymentStatus !== "PAID" || (["PAID", "CANCELLED"].includes(v.orderStatus) && v.providerStatus === "PAID" && !!v.paidAt && !!v.transactionId && !v.canOpenPaymentWindow))
  .refine(v => v.paymentStatus !== "CANCELLED" || (v.orderStatus === "CANCELLED" && v.providerStatus === "CANCELLED" && !v.canOpenPaymentWindow))
  .refine(v => !v.canOpenPaymentWindow || (v.paymentStatus === "READY" && v.orderStatus === "CREATED" && ["NOT_FOUND", "READY", "FAILED"].includes(v.providerStatus)));

export type PaymentVerification = z.infer<typeof verificationSchema>;

export async function verifyPayment(orderId: number | null, paymentId?: string): Promise<PaymentVerification> {
  if (orderId === null && !paymentId) throw new Error("결제 ID가 없습니다.");
  // 결제 ID만 있으면 휴대폰 복귀, 주문 ID만 있으면 기존 결제 복구 경로를 사용한다.
  const path = orderId === null
    ? `/api/payments/${encodeURIComponent(paymentId!)}/verify`
    : `/api/orders/${orderId}/payments${paymentId ? `/${encodeURIComponent(paymentId)}` : ""}/verify`;
  const parsed = verificationSchema.safeParse(await apiFetch<unknown>(path, { method: "POST" }));
  if (!parsed.success) throw new Error("결제 확인 응답을 읽지 못했습니다. 다시 확인해 주세요.");
  // 형식이 맞아도 다른 주문이나 결제의 응답이면 사용하지 않는다.
  if ((orderId !== null && parsed.data.orderId !== orderId) || (paymentId && parsed.data.paymentId !== paymentId)) {
    throw new Error("요청한 결제와 확인 결과가 일치하지 않습니다.");
  }
  return parsed.data;
}
