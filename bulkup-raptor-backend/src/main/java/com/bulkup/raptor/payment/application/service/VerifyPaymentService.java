package com.bulkup.raptor.payment.application.service;

import com.bulkup.raptor.auth.domain.MemberStatus;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.order.repository.OrderRepository;
import com.bulkup.raptor.payment.api.VerifyPaymentResponse;
import com.bulkup.raptor.payment.domain.Payment;
import com.bulkup.raptor.payment.domain.PaymentStatus;
import com.bulkup.raptor.payment.infrastructure.PortOnePaymentClient;
import com.bulkup.raptor.payment.repository.PaymentRepository;
import com.bulkup.raptor.order.domain.Order;
import java.time.Instant;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
public class VerifyPaymentService {
    private final MemberRepository members;
    private final OrderRepository orders;
    private final PaymentRepository payments;
    private final PortOnePaymentClient portone;
    private final TransactionTemplate transactions;
    private final PaidCancellationSettlementService cancellations;
    private final PaymentCancellationExecutor refunds;
    private final com.bulkup.raptor.inventory.application.service.StockReservationService stock;
    private final com.bulkup.raptor.delivery.application.service.DeliveryCreationService deliveries;

    private record Target(Long memberId, Long orderId, String paymentId) {}

    public VerifyPaymentResponse verify(Long memberId, Long orderId, String paymentId) {
        if (memberId == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
        if ((orderId != null && orderId <= 0) || (paymentId != null && !paymentId.matches("[A-Za-z0-9_-]{1,64}"))
                || (orderId == null && paymentId == null)) throw new BusinessException(ErrorCode.INVALID_INPUT);
        // 먼저 소유자를 확인하고, 누락된 주문 ID 또는 결제 ID를 DB에서 찾는다.
        Target target = transactions.execute(tx -> {
            checkActiveMember(memberId, false);
            Payment payment;
            if (orderId != null) {
                orders.findByIdAndMemberId(orderId, memberId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND));
                payment = paymentId == null
                        ? payments.findByOrderId(orderId)
                            .orElseThrow(() -> new BusinessException(ErrorCode.PAYMENT_NOT_FOUND))
                        : payments.findById(paymentId).orElseThrow(() -> new BusinessException(ErrorCode.PAYMENT_NOT_FOUND));
            } else {
                payment = payments.findById(paymentId).orElseThrow(() -> new BusinessException(ErrorCode.PAYMENT_NOT_FOUND));
            }
            checkOwner(payment, memberId, orderId);
            return new Target(memberId, payment.getOrder().getId(), payment.getPaymentId());
        });
        return verifyTarget(target, true, false);
    }

    // 서명 검증을 통과한 웹훅만 호출하며 회원 ID는 요청이 아닌 DB에서 가져온다.
    public void verifyWebhook(String paymentId) { verifyStoredPayment(paymentId, true); }

    public void reconcilePayment(String paymentId) { verifyStoredPayment(paymentId, false); }

    // Reconciliation also accepts verified unpaid states; a paid webhook still requires PAID.
    private void verifyStoredPayment(String paymentId, boolean paidNotification) {
        Target target = transactions.execute(tx -> payments.findById(paymentId)
                .filter(payment -> payment.getStatus() != PaymentStatus.RETIRED)
                .map(payment -> new Target(payment.getMember().getId(), payment.getOrder().getId(), payment.getPaymentId()))
                .orElse(null));
        // 같은 상점을 사용하는 다른 서비스의 결제는 처리하지 않는다.
        if (target != null) verifyTarget(target, false, paidNotification);
    }

    /**
     * 프런트 요청과 웹훅이 함께 사용하는 실제 결제 검증 로직이다.
     * 포트원에서 결제를 조회해 DB 결제·주문의 금액, 통화, 소유 관계와 서버의 상점·채널 설정을 확인한다.
     * 결제 완료 상태와 증빙까지 검증하면 결제·주문을 PAID로 반영하고, 웹훅 경로이면 검증 시각도 기록한다.
     *
     * @param target DB에서 확인한 회원 ID, 주문 ID, 결제 ID
     * @param requireActiveMember true이면 활성 회원만 허용한다. 프런트는 true, 웹훅은 false이다.
     * @param paidNotification true이면 완료 웹훅으로 처리한다. 조회 결과가 아직 PAID가 아니면 재시도를 유도한다.
     * @return 검증한 결제 정보와 결제 재시도 가능 여부
     */
    private VerifyPaymentResponse verifyTarget(Target target, boolean requireActiveMember, boolean paidNotification) {
        Long memberId = target.memberId();
        // 외부 API를 기다리는 동안 DB 잠금을 유지하지 않는다.
        var remote = portone.find(target.paymentId());
        var result = transactions.execute(tx -> {
            // 사용자 요청은 회원 상태 변경과 직렬화한다. 웹훅·재조회는 주문부터 잠근다.
            // 이미 발생한 결제는 회원 정지 여부와 관계없이 반영한다.
            if (requireActiveMember) checkActiveMember(memberId, true);
            var order = orders.findByIdAndMemberIdForUpdate(target.orderId(), memberId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND));
            var payment = payments.findById(target.paymentId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.PAYMENT_NOT_FOUND));
            checkOwner(payment, memberId, target.orderId());
            if (payment.getStatus() == PaymentStatus.RETIRED) {
                if (!requireActiveMember) return null;
                throw new BusinessException(ErrorCode.PAYMENT_VERIFICATION_CONFLICT);
            }
            // Terminal cancellation cannot be overwritten by an older paid lookup or webhook.
            if (payment.getStatus() == PaymentStatus.CANCELLED && "CANCELLED".equals(order.getStatus()))
                return response(payment, "CANCELLED", false);
            // 완료 알림을 받았지만 조회 결과가 아직 반영되지 않았다면 재전송을 요청한다.
            if (paidNotification && (remote == null || !"PAID".equals(remote.status())))
                throw new BusinessException(ErrorCode.PAYMENT_WEBHOOK_RETRY_REQUIRED);
            // 포트원에 결제가 없더라도, DB에 완료 기록이 있으면 재결제를 허용하지 않는다.
            if (remote == null) {
                if (payment.getStatus() != PaymentStatus.READY || !"CREATED".equals(order.getStatus()))
                    throw new BusinessException(ErrorCode.PAYMENT_VERIFICATION_CONFLICT);
                if (stock.needsReconciliation(order)) {
                    if (reservationExpired(order)) releaseExpired(order);
                    else if (requireActiveMember && payment.isKeepOrderOnRelease()) stock.resumeForRetry(order);
                    else stock.review(order);
                }
                return response(payment, "NOT_FOUND", stock.hasValidReservation(order));
            }
            // 다른 상점·채널의 결제나 주문 금액과 다른 결제는 완료 처리하지 않는다.
            if (!target.paymentId().equals(remote.id()) || !portone.matchesConfiguration(remote)
                    || payment.getTotalAmount() != remote.totalAmount() || order.getTotalAmount() != remote.totalAmount()
                    || !payment.getCurrency().equals(remote.currency()))
                throw new BusinessException(ErrorCode.PAYMENT_VERIFICATION_MISMATCH);
            if ("CANCELLED".equals(remote.status()) && order.isPaidCancellationPending()) {
                cancellations.complete(order, payment, remote);
                return response(payment, remote.status(), false);
            }
            if ("PAID".equals(remote.status()) && "CANCELLED".equals(order.getStatus())
                    && payment.getStatus() != PaymentStatus.CANCELLED) {
                if (remote.paidAt() == null || remote.transactionId().isBlank() || remote.cancelledAmount() != 0)
                    throw new BusinessException(ErrorCode.PAYMENT_VERIFICATION_CONFLICT);
                // A late payment must be refunded, never reopen or fulfill the cancelled order.
                payment.markPaid(remote.paidAt(), remote.transactionId(), remote.pgTxId(), remote.method());
                order.requestPaidCancellation();
                if (paidNotification) payment.markWebhookVerified();
                return response(payment, remote.status(), false);
            }
            if ("PAID".equals(remote.status())) {
                // 완료 증빙이 없거나 취소 금액이 있으면 결제 완료로 반영하지 않는다.
                if (remote.paidAt() == null || remote.transactionId().isBlank() || remote.cancelledAmount() != 0
                        || !("CREATED".equals(order.getStatus()) || "PAID".equals(order.getStatus()))
                        || (payment.getStatus() != PaymentStatus.PAID
                            && payments.existsByOrderIdAndStatus(order.getId(), PaymentStatus.PAID)))
                    throw new BusinessException(ErrorCode.PAYMENT_VERIFICATION_CONFLICT);
                // 결제와 주문은 함께 저장하며, 한쪽이 실패하면 모두 되돌린다.
                stock.confirm(order);
                payment.markPaid(remote.paidAt(), remote.transactionId(), remote.pgTxId(), remote.method());
                order.markPaid();
                // Both browser verification and signed webhooks create the same delivery atomically.
                deliveries.ensureForPaidOrder(order.getId());
                // 서명 검사를 통과한 웹훅의 실제 결제 검증까지 성공한 경우만 기록한다.
                if (paidNotification) payment.markWebhookVerified();
                payments.flush();
                return response(payment, remote.status(), false);
            }
            // 늦게 도착한 미결제 응답으로 이미 완료된 결제를 되돌리지 않는다.
            if (payment.getStatus() == PaymentStatus.PAID || "PAID".equals(order.getStatus()))
                throw new BusinessException(ErrorCode.PAYMENT_VERIFICATION_CONFLICT);
            if (!Set.of("READY", "FAILED", "PENDING", "VIRTUAL_ACCOUNT_ISSUED", "CANCELLED", "PARTIAL_CANCELLED").contains(remote.status()))
                throw new BusinessException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE);
            if (order.isInventoryManaged() && stock.needsReconciliation(order)) {
                if (reservationExpired(order) && Set.of("READY", "FAILED").contains(remote.status()))
                    releaseExpired(order);
                else if ("FAILED".equals(remote.status()) && !payment.isKeepOrderOnRelease()) releaseIfExpired(order);
                else if (requireActiveMember && payment.isKeepOrderOnRelease()
                        && Set.of("READY", "FAILED").contains(remote.status())) stock.resumeForRetry(order);
            }
            // Only a final cancellation releases retryable inventory. Ambiguous states remain held.
            if (order.isInventoryManaged() && "CANCELLED".equals(remote.status())
                    && remote.cancelledAmount() == remote.totalAmount()) {
                if (reservationExpired(order)) releaseExpired(order);
                else if (payment.isKeepOrderOnRelease()) stock.release(order, false);
                else releaseIfExpired(order);
            } else if (!"FAILED".equals(remote.status()) && stock.needsReconciliation(order)) {
                stock.review(order);
            }
            return response(payment, remote.status(), "CREATED".equals(order.getStatus())
                    && Set.of("READY", "FAILED").contains(remote.status()) && stock.hasValidReservation(order));
        });
        if (result != null && "CANCELLED".equals(result.orderStatus()) && "PAID".equals(result.paymentStatus())) {
            refunds.reconcile(target.paymentId());
            return transactions.execute(tx -> {
                var payment = payments.findById(target.paymentId()).orElseThrow();
                return response(payment, payment.getStatus() == PaymentStatus.CANCELLED ? "CANCELLED" : "PAID", false);
            });
        }
        return result;
    }

    private boolean reservationExpired(Order order) {
        var expiresAt = stock.snapshot(order).expiresAt();
        return expiresAt != null && !expiresAt.isAfter(Instant.now());
    }

    private void releaseExpired(Order order) {
        stock.expireUnpaid(order);
    }

    private void releaseIfExpired(Order order) {
        if (reservationExpired(order)) releaseExpired(order);
        else stock.release(order, true);
    }

    private VerifyPaymentResponse response(Payment payment, String providerStatus, boolean canOpenPaymentWindow) {
        return VerifyPaymentResponse.from(payment, providerStatus, canOpenPaymentWindow, stock.snapshot(payment.getOrder()));
    }

    private void checkActiveMember(Long memberId, boolean lock) {
        var member = (lock ? members.findByIdForUpdate(memberId) : members.findById(memberId))
                .orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_REQUIRED));
        if (member.getStatus() != MemberStatus.ACTIVE) throw new BusinessException(ErrorCode.MEMBER_SUSPENDED);
    }

    private void checkOwner(Payment payment, Long memberId, Long orderId) {
        if (!payment.getMember().getId().equals(memberId)
                || (orderId != null && !payment.getOrder().getId().equals(orderId)))
            throw new BusinessException(ErrorCode.PAYMENT_NOT_FOUND);
    }
}
