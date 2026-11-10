package com.bulkup.raptor.payment.application.service;

import com.bulkup.raptor.common.error.*;
import com.bulkup.raptor.inventory.application.service.StockReservationService;
import com.bulkup.raptor.order.domain.Order;
import com.bulkup.raptor.payment.domain.Payment;
import com.bulkup.raptor.payment.infrastructure.PortOnePaymentClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
@RequiredArgsConstructor
@Transactional(propagation = Propagation.MANDATORY)
public class PaidCancellationSettlementService {
    private final StockReservationService stock;

    // Caller holds the order lock and has verified remote identity, amount and currency.
    public void complete(Order order, Payment payment, PortOnePaymentClient.RemotePayment remote) {
        if (!"CANCELLED".equals(remote.status()) || remote.cancelledAmount() != payment.getTotalAmount())
            throw new BusinessException(ErrorCode.PAYMENT_VERIFICATION_CONFLICT);
        if ("CANCELLED".equals(order.getStatus()) && payment.getStatus() == com.bulkup.raptor.payment.domain.PaymentStatus.CANCELLED) return;
        if (!order.isPaidCancellationPending()) throw new BusinessException(ErrorCode.PAYMENT_VERIFICATION_CONFLICT);
        String inventory = stock.snapshot(order).status();
        if ("CONFIRMED".equals(inventory)) stock.refund(order);
        else if (java.util.Set.of("RESERVED", "RELEASE_PENDING", "REVIEW_REQUIRED").contains(inventory)) stock.release(order, false);
        payment.markCancelled();
        order.completePaidCancellation();
    }
}
