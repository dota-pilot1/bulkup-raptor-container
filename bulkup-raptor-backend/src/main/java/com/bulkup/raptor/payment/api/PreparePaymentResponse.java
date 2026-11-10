package com.bulkup.raptor.payment.api;

import com.bulkup.raptor.payment.domain.Payment;
import com.bulkup.raptor.inventory.application.service.StockReservationService.Snapshot;
import java.time.Instant;

public record PreparePaymentResponse(String paymentId, String orderName, long totalAmount, String currency,
        String inventoryStatus, Instant reservationExpiresAt) {
    public static PreparePaymentResponse from(Payment payment, Snapshot reservation) {
        return new PreparePaymentResponse(payment.getPaymentId(), payment.getOrderName(),
                payment.getTotalAmount(), payment.getCurrency(), reservation.status(), reservation.expiresAt());
    }
}
