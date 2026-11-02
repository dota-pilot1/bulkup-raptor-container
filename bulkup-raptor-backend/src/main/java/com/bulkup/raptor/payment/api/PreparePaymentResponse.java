package com.bulkup.raptor.payment.api;

import com.bulkup.raptor.payment.domain.Payment;

public record PreparePaymentResponse(
        String paymentId, String orderName, long totalAmount, String currency) {

    public static PreparePaymentResponse from(Payment payment) {
        return new PreparePaymentResponse(payment.getPaymentId(), payment.getOrderName(),
                payment.getTotalAmount(), payment.getCurrency());
    }
}
