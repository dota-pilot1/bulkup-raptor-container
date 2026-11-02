package com.bulkup.raptor.payment.application.service;

import com.bulkup.raptor.auth.domain.MemberStatus;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.order.repository.OrderRepository;
import com.bulkup.raptor.payment.api.PreparePaymentResponse;
import com.bulkup.raptor.payment.domain.Payment;
import com.bulkup.raptor.payment.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PreparePaymentService {
    private final MemberRepository members;
    private final OrderRepository orders;
    private final PaymentRepository payments;

    public record Preparation(PreparePaymentResponse payment, boolean created) {}

    @Transactional
    public Preparation prepare(Long memberId, Long orderId) {
        if (memberId == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
        if (orderId == null || orderId <= 0)
            throw new BusinessException(ErrorCode.INVALID_INPUT);

        // 주문 생성과 동일하게 회원 → 주문 순서로 잠근다.
        var member = members.findByIdForUpdate(memberId)
                .orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_REQUIRED));
        if (member.getStatus() != MemberStatus.ACTIVE)
            throw new BusinessException(ErrorCode.MEMBER_SUSPENDED);
        var order = orders.findByIdAndMemberIdForUpdate(orderId, memberId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND));

        // 새로고침·새 탭의 요청도 주문에 저장된 같은 결제 정보를 반환한다.
        var existing = payments.findByOrderId(orderId);
        if (existing.isPresent())
            return new Preparation(PreparePaymentResponse.from(existing.get()), false);

        if (!"CREATED".equals(order.getStatus()) || order.getItems().isEmpty()
                || order.getTotalAmount() < 0 || order.getTotalAmount() > 9_007_199_254_740_991L)
            throw new BusinessException(ErrorCode.PAYMENT_ORDER_NOT_PAYABLE);

        var payment = payments.saveAndFlush(Payment.ready(order));
        // 결제 준비만 저장한다. 주문 상태와 장바구니는 변경하지 않는다.
        return new Preparation(PreparePaymentResponse.from(payment), true);
    }
}
