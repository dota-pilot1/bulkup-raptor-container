package com.bulkup.raptor.payment.application.service;

import com.bulkup.raptor.common.error.*;
import com.bulkup.raptor.order.repository.OrderRepository;
import com.bulkup.raptor.payment.domain.PaymentStatus;
import com.bulkup.raptor.payment.infrastructure.PortOnePaymentClient;
import com.bulkup.raptor.payment.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
public class PaymentCancellationExecutor {
    private final OrderRepository orders;
    private final PaymentRepository payments;
    private final PortOnePaymentClient portone;
    private final PaidCancellationSettlementService settlement;
    private final TransactionTemplate transactions;
    private record Target(Long orderId, String paymentId, long amount, String currency) {}

    public void reconcile(String paymentId) {
        var target = transactions.execute(tx -> payments.findById(paymentId)
                .filter(p -> p.getStatus() == PaymentStatus.PAID && p.getOrder().isPaidCancellationPending())
                .map(p -> new Target(p.getOrder().getId(), paymentId, p.getTotalAmount(), p.getCurrency())).orElse(null));
        if (target == null) return;
        try {
            var remote = portone.find(paymentId);
            validate(target, remote);
            if ("PAID".equals(remote.status()) && remote.cancelledAmount() == 0) {
                portone.cancel(paymentId, target.amount());
                remote = portone.find(paymentId);
                validate(target, remote);
            }
            final var verified = remote;
            if ("CANCELLED".equals(remote.status()) && remote.cancelledAmount() == target.amount()) {
                transactions.executeWithoutResult(tx -> {
                    var order = orders.findByIdForUpdate(target.orderId()).orElseThrow();
                    var payment = payments.findById(paymentId).orElseThrow();
                    settlement.complete(order, payment, verified);
                });
            }
        } catch (BusinessException error) {
            if (error.getErrorCode() != ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE
                    && error.getErrorCode() != ErrorCode.PAYMENT_PROVIDER_NOT_CONFIGURED) throw error;
        }
    }

    private void validate(Target target, PortOnePaymentClient.RemotePayment remote) {
        if (remote == null || !target.paymentId().equals(remote.id()) || !portone.matchesConfiguration(remote)
                || remote.totalAmount() != target.amount() || !target.currency().equals(remote.currency()))
            throw new BusinessException(ErrorCode.PAYMENT_VERIFICATION_MISMATCH);
    }
}
