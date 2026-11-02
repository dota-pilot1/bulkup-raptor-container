package com.bulkup.raptor.payment.api;

import com.bulkup.raptor.payment.domain.Payment;
import java.time.Instant;

// paymentStatus·orderStatus는 DB 상태이며, providerStatus는 포트원 조회 상태이다.
// canRetry는 같은 결제 ID로 결제창을 다시 열 수 있는지 나타낸다.
public record VerifyPaymentResponse(Long orderId, String paymentId, String orderName, long totalAmount,
        String currency, String paymentStatus, String orderStatus, String providerStatus,
        Instant paidAt, String transactionId, String pgTxId, String paymentMethod, boolean canRetry) {
    public static VerifyPaymentResponse from(Payment payment, String providerStatus, boolean canRetry) {
        return new VerifyPaymentResponse(payment.getOrder().getId(), payment.getPaymentId(), payment.getOrderName(),
                payment.getTotalAmount(), payment.getCurrency(), payment.getStatus().name(),
                payment.getOrder().getStatus(), providerStatus, payment.getPaidAt(), payment.getTransactionId(),
                payment.getPgTxId(), payment.getPaymentMethod(), canRetry);
    }
}
