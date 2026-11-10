package com.bulkup.raptor.admin.api;

import com.bulkup.raptor.payment.domain.Payment;
import com.bulkup.raptor.payment.domain.PaymentStatus;
import java.time.Instant;
import java.util.List;

public record AdminPaymentPageResponse(List<Item> content, int page, int size, int totalPages, long totalElements) {
    public record Item(Long orderId, String paymentId, long totalAmount, String currency,
            String paymentMethod, PaymentStatus status, Instant createdAt, Instant paidAt, Instant webhookVerifiedAt) {
        public static Item from(Payment payment) {
            return new Item(payment.getOrder().getId(), payment.getPaymentId(), payment.getTotalAmount(),
                    payment.getCurrency(), payment.getPaymentMethod(), payment.getStatus(),
                    payment.getCreatedAt(), payment.getPaidAt(), payment.getWebhookVerifiedAt());
        }
    }
}
