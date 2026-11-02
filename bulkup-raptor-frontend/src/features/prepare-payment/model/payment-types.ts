import { z } from "zod";

// 백엔드가 확정한 결제 정보만 사용한다. 금액이나 주문명을 프런트에서 만들지 않는다.
export const preparedPaymentSchema = z.object({
  paymentId: z.string().trim().min(1),
  orderName: z.string().trim().min(1),
  totalAmount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  currency: z.literal("KRW"),
});

export type PreparedPayment = z.infer<typeof preparedPaymentSchema>;
