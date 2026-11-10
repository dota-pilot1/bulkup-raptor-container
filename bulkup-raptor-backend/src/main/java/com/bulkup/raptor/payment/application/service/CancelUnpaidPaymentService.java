package com.bulkup.raptor.payment.application.service;

import com.bulkup.raptor.auth.domain.MemberStatus;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.*;
import com.bulkup.raptor.inventory.application.service.StockReservationService;
import com.bulkup.raptor.order.repository.OrderRepository;
import com.bulkup.raptor.payment.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
public class CancelUnpaidPaymentService {
    private final MemberRepository members;
    private final OrderRepository orders;
    private final PaymentRepository payments;
    private final StockReservationService stock;
    private final VerifyPaymentService verification;
    private final TransactionTemplate transactions;

    public record Result(Long orderId, String orderStatus, String inventoryStatus, boolean pending) {}
    private record Target(Long memberId, String paymentId, boolean check) {}

    public Result cancel(Long memberId, Long orderId) {
        if (memberId == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
        if (orderId == null || orderId <= 0) throw new BusinessException(ErrorCode.INVALID_INPUT);
        return reconcile(memberId, orderId, true, false);
    }

    public Result releaseReservation(Long memberId, Long orderId) {
        if (memberId == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
        if (orderId == null || orderId <= 0) throw new BusinessException(ErrorCode.INVALID_INPUT);
        return reconcile(memberId, orderId, true, true);
    }

    // Scheduler uses DB ownership rather than a client-supplied member ID.
    public Result reconcileExpired(Long orderId) { return reconcile(null, orderId, false, false); }

    private Result reconcile(Long requestedMemberId, Long orderId, boolean interactive, boolean keepOrder) {
        var target = transactions.execute(tx -> {
            Long memberId = requestedMemberId;
            if (!interactive) memberId = orders.findOwnerId(orderId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND));
            // Only the user's initial request must serialize with member suspension.
            // Expiry and follow-up reconciliation depend on order ownership, not active status.
            if (interactive) {
                var member = members.findByIdForUpdate(memberId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_REQUIRED));
                if (member.getStatus() != MemberStatus.ACTIVE)
                    throw new BusinessException(ErrorCode.MEMBER_SUSPENDED);
            }
            var order = orders.findByIdAndMemberIdForUpdate(orderId, memberId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND));
            if (keepOrder && !order.isInventoryManaged()) return new Target(memberId, null, false);
            if (!order.isInventoryManaged()) {
                if ("PAID".equals(order.getStatus()) || "CANCELLED".equals(order.getStatus()))
                    return new Target(memberId, null, false);
                // 예약 도입 전 주문도 결제를 준비한 적이 없으면 안전하게 취소할 수 있다.
                if (payments.findByOrderId(orderId).isPresent())
                    throw new BusinessException(ErrorCode.STOCK_LEGACY_ORDER);
                order.cancelUnpaid();
                return new Target(memberId, null, false);
            }
            var state = stock.snapshot(order);
            if ("PAID".equals(order.getStatus()) || "CANCELLED".equals(order.getStatus()))
                return new Target(memberId, null, false);
            if ("RELEASED".equals(state.status())) {
                if (interactive && !keepOrder) order.cancelUnpaid();
                return new Target(memberId, null, false);
            }
            if ("NOT_RESERVED".equals(state.status())) {
                if (keepOrder) return new Target(memberId, null, false);
                // No payment was ever prepared: there is no remote payment ID to race against.
                if (payments.findByOrderId(orderId).isPresent())
                    throw new BusinessException(ErrorCode.STOCK_RESERVATION_CONFLICT);
                order.cancelUnpaid();
                return new Target(memberId, null, false);
            }
            if (!interactive && !stock.needsReconciliation(order)) return new Target(memberId, null, false);
            var payment = payments.findByOrderId(orderId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.PAYMENT_NOT_FOUND));
            if (keepOrder) payment.releaseForRetry();
            if (interactive && !keepOrder) payment.releaseForCancellation();
            stock.requestRelease(order);
            return new Target(memberId, payment.getPaymentId(), true);
        });
        if (target.check()) {
            try {
                // External lookup happens after RELEASE_PENDING commits, without holding DB locks.
                verification.reconcilePayment(target.paymentId());
            } catch (RuntimeException error) {
                transactions.executeWithoutResult(tx -> finishExpiredOrReview(orderId, target, interactive));
            }
            if (!interactive) transactions.executeWithoutResult(tx -> {
                var order = orders.findByIdAndMemberIdForUpdate(orderId, target.memberId()).orElseThrow();
                stock.expireUnpaid(order);
            });
        }
        return transactions.execute(tx -> {
            var order = orders.findByIdAndMemberIdForUpdate(orderId, target.memberId()).orElseThrow();
            String status = stock.snapshot(order).status();
            return new Result(orderId, order.getStatus(), status,
                    java.util.Set.of("RESERVED", "RELEASE_PENDING", "REVIEW_REQUIRED").contains(status));
        });
    }

    private void finishExpiredOrReview(Long orderId, Target target, boolean interactive) {
        var order = orders.findByIdAndMemberIdForUpdate(orderId, target.memberId()).orElseThrow();
        if (payments.findByOrderId(orderId)
                .filter(payment -> payment.getPaymentId().equals(target.paymentId())).isEmpty()) return;
        if (!interactive && stock.expireUnpaid(order)) return;
        stock.review(order);
    }
}
