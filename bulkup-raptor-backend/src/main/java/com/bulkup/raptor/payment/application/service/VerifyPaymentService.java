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

    private record Target(Long memberId, Long orderId, String paymentId) {}

    public VerifyPaymentResponse verify(Long memberId, Long orderId, String paymentId) {
        if (memberId == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
        if ((orderId != null && orderId <= 0) || (paymentId != null && !paymentId.matches("[A-Za-z0-9_-]{1,64}"))
                || (orderId == null && paymentId == null)) throw new BusinessException(ErrorCode.INVALID_INPUT);
        // 먼저 소유자를 확인하고, 누락된 주문 ID 또는 결제 ID를 DB에서 찾는다.
        Target target = transactions.execute(tx -> {
            checkMember(memberId, false);
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
    public void verifyWebhook(String paymentId) {
        Target target = transactions.execute(tx -> payments.findById(paymentId)
                .map(payment -> new Target(payment.getMember().getId(), payment.getOrder().getId(), payment.getPaymentId()))
                .orElse(null));
        // 같은 상점을 사용하는 다른 서비스의 결제는 처리하지 않는다.
        if (target != null) verifyTarget(target, false, true);
    }

    private VerifyPaymentResponse verifyTarget(Target target, boolean requireActiveMember, boolean paidNotification) {
        Long memberId = target.memberId();
        // 외부 API를 기다리는 동안 DB 잠금을 유지하지 않는다.
        var remote = portone.find(target.paymentId());
        return transactions.execute(tx -> {
            // 회원 → 주문 순서로 잠그고, 외부 조회 중 바뀐 상태를 다시 확인한다.
            // 결제 후 회원이 정지되어도 실제 결제 내역은 웹훅으로 반영한다.
            checkMember(memberId, true, requireActiveMember);
            var order = orders.findByIdAndMemberIdForUpdate(target.orderId(), memberId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND));
            var payment = payments.findById(target.paymentId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.PAYMENT_NOT_FOUND));
            checkOwner(payment, memberId, target.orderId());
            // 완료 알림을 받았지만 조회 결과가 아직 반영되지 않았다면 재전송을 요청한다.
            if (paidNotification && (remote == null || !"PAID".equals(remote.status())))
                throw new BusinessException(ErrorCode.PAYMENT_WEBHOOK_RETRY_REQUIRED);
            // 포트원에 결제가 없더라도, DB에 완료 기록이 있으면 재결제를 허용하지 않는다.
            if (remote == null) {
                if (payment.getStatus() != PaymentStatus.READY || !"CREATED".equals(order.getStatus()))
                    throw new BusinessException(ErrorCode.PAYMENT_VERIFICATION_CONFLICT);
                return VerifyPaymentResponse.from(payment, "NOT_FOUND", true);
            }
            // 다른 상점·채널의 결제나 주문 금액과 다른 결제는 완료 처리하지 않는다.
            if (!target.paymentId().equals(remote.id()) || !portone.matchesConfiguration(remote)
                    || payment.getTotalAmount() != remote.totalAmount() || order.getTotalAmount() != remote.totalAmount()
                    || !payment.getCurrency().equals(remote.currency()))
                throw new BusinessException(ErrorCode.PAYMENT_VERIFICATION_MISMATCH);
            if ("PAID".equals(remote.status())) {
                // 완료 증빙이 없거나 취소 금액이 있으면 결제 완료로 반영하지 않는다.
                if (remote.paidAt() == null || remote.transactionId().isBlank() || remote.cancelledAmount() != 0
                        || !("CREATED".equals(order.getStatus()) || "PAID".equals(order.getStatus()))
                        || (payment.getStatus() != PaymentStatus.PAID
                            && payments.existsByOrderIdAndStatus(order.getId(), PaymentStatus.PAID)))
                    throw new BusinessException(ErrorCode.PAYMENT_VERIFICATION_CONFLICT);
                // 결제와 주문은 함께 저장하며, 한쪽이 실패하면 모두 되돌린다.
                payment.markPaid(remote.paidAt(), remote.transactionId(), remote.pgTxId(), remote.method());
                order.markPaid();
                // 서명 검사를 통과한 웹훅의 실제 결제 검증까지 성공한 경우만 기록한다.
                if (paidNotification) payment.markWebhookVerified();
                payments.flush();
                return VerifyPaymentResponse.from(payment, remote.status(), false);
            }
            // 늦게 도착한 미결제 응답으로 이미 완료된 결제를 되돌리지 않는다.
            if (payment.getStatus() == PaymentStatus.PAID || "PAID".equals(order.getStatus()))
                throw new BusinessException(ErrorCode.PAYMENT_VERIFICATION_CONFLICT);
            if (!Set.of("READY", "FAILED", "PENDING", "VIRTUAL_ACCOUNT_ISSUED", "CANCELLED", "PARTIAL_CANCELLED").contains(remote.status()))
                throw new BusinessException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE);
            // 결제 대기·취소 상태는 재결제를 막고, READY·FAILED만 재시도를 허용한다.
            return VerifyPaymentResponse.from(payment, remote.status(),
                    "CREATED".equals(order.getStatus()) && Set.of("READY", "FAILED").contains(remote.status()));
        });
    }

    private void checkMember(Long memberId, boolean lock) {
        checkMember(memberId, lock, true);
    }

    private void checkMember(Long memberId, boolean lock, boolean requireActive) {
        var member = (lock ? members.findByIdForUpdate(memberId) : members.findById(memberId))
                .orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_REQUIRED));
        if (requireActive && member.getStatus() != MemberStatus.ACTIVE) throw new BusinessException(ErrorCode.MEMBER_SUSPENDED);
    }

    private void checkOwner(Payment payment, Long memberId, Long orderId) {
        if (!payment.getMember().getId().equals(memberId)
                || (orderId != null && !payment.getOrder().getId().equals(orderId)))
            throw new BusinessException(ErrorCode.PAYMENT_NOT_FOUND);
    }
}
