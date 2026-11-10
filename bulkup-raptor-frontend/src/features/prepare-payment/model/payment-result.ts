import type { PaymentVerification } from "../api/verify-payment";

export type PaymentResult = {
  status: "received" | "cancelled" | "failed" | "unknown" | "verified" | "unpaid";
  paymentId?: string;
  response?: PaymentResponse;
  verification?: PaymentVerification;
};

export type PaymentResponse = {
  transactionType?: string;
  txId?: string;
  paymentId?: string;
  code?: string;
  message?: string;
  pgCode?: string;
  pgMessage?: string;
};

export function readPaymentResult(response?: PaymentResponse): PaymentResult {
  const fields: PaymentResponse = {};
  // 표시할 필드만 복사하며, SDK가 반환한 다른 정보는 보관하지 않는다.
  const keys = ["transactionType", "txId", "paymentId", "code", "message", "pgCode", "pgMessage"] as const;
  for (const key of keys) {
    if (typeof response?.[key] === "string") fields[key] = response[key];
  }
  const details = response ? { response: fields } : {};
  if (response?.code) {
    const cancelled = response.pgCode === "CANCEL"
      || response.code === "Cancelled"
      || response.code === "FAILURE_TYPE_PG_CANCEL"
      || /취소|cancel/i.test(response.message ?? "");
    return { status: cancelled ? "cancelled" : "failed", paymentId: response.paymentId, ...details };
  }
  return response?.paymentId
    ? { status: "received", paymentId: response.paymentId, ...details }
    : { status: "unknown", ...details };
}

export function readPaymentRedirect(params: Record<string, string | string[] | undefined>): PaymentResult {
  // 복귀 URL은 외부 입력이므로 중복 값과 과도하게 긴 값을 거부한다.
  const limits = { transactionType: 50, txId: 100, paymentId: 64, code: 100, message: 300, pgCode: 100, pgMessage: 300 };
  for (const [key, max] of Object.entries(limits)) {
    const entry = params[key];
    if (entry !== undefined && (typeof entry !== "string" || entry.length > max)) {
      return { status: "unknown" };
    }
  }
  const value = (key: string, max: number) => {
    const entry = params[key];
    return typeof entry === "string" && entry.length <= max ? entry.trim() : undefined;
  };
  return readPaymentResult({
    transactionType: value("transactionType", 50),
    txId: value("txId", 100),
    paymentId: value("paymentId", 64),
    code: value("code", 100),
    message: value("message", 300),
    pgCode: value("pgCode", 100),
    pgMessage: value("pgMessage", 300),
  });
}

export function paymentResultMessage(result: PaymentResult): string {
  switch (result.status) {
    case "verified": return "서버에서 결제 완료를 확인했습니다.";
    case "unpaid": return result.verification?.orderStatus === "CANCELLED" ? "취소된 주문입니다." : result.verification?.canOpenPaymentWindow
      ? "아직 결제되지 않았습니다. 기존 결제 정보로 결제창을 다시 열 수 있습니다."
      : "현재 결제를 다시 진행할 수 없습니다. 결제 상태를 다시 확인해 주세요.";
    case "received": return "결제 응답을 받았습니다. 결제 완료 여부는 아직 확인되지 않았습니다.";
    case "cancelled": return "결제를 취소했습니다. 원하면 결제창을 다시 열 수 있습니다.";
    case "failed": return "결제를 진행하지 못했습니다. 주문 내역을 확인한 뒤 다시 시도해 주세요.";
    case "unknown": return "결제 결과를 확인하지 못했습니다. 주문 내역을 확인해 주세요.";
  }
}

export function verifiedPaymentResult(verification: PaymentVerification, response?: PaymentResponse): PaymentResult {
  // SDK 응답이 아닌 서버 검증 결과를 기준으로 완료 여부를 정한다.
  return { status: verification.paymentStatus === "PAID" && verification.orderStatus === "PAID" ? "verified" : "unpaid",
    paymentId: verification.paymentId, verification, ...(response ? { response } : {}) };
}
