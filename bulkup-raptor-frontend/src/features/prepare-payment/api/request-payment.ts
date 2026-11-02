import * as PortOne from "@portone/browser-sdk/v2";
import type { PreparedPayment } from "../model/payment-types";
import { readPaymentResult, type PaymentResult } from "../model/payment-result";

export async function requestPayment(payment: PreparedPayment): Promise<PaymentResult> {
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID?.trim();
  const channelKey = process.env.NEXT_PUBLIC_PORTONE_KAKAOPAY_CHANNEL_KEY?.trim();
  if (!storeId || !channelKey) {
    throw new Error("결제창 설정이 없습니다. 상점 ID와 테스트 채널 키를 확인해 주세요.");
  }

  let response;
  try {
    response = await PortOne.requestPayment({
      storeId,
      channelKey,
      paymentId: payment.paymentId,
      orderName: payment.orderName,
      totalAmount: payment.totalAmount,
      currency: payment.currency,
      payMethod: "EASY_PAY",
      windowType: { pc: "IFRAME", mobile: "REDIRECTION" },
      redirectUrl: `${window.location.origin}/payments/result`,
    });
  } catch (error) {
    if (PortOne.isPaymentError(error)) return readPaymentResult(error);
    throw new Error("결제창을 열지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }

  if (response?.paymentId && response.paymentId !== payment.paymentId) {
    return { status: "unknown" };
  }
  return readPaymentResult(response);
}
