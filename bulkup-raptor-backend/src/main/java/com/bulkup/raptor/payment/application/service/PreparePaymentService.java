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
    private final com.bulkup.raptor.inventory.application.service.StockReservationService stock;

    public record Preparation(PreparePaymentResponse payment, boolean created) {}

    @Transactional
    public Preparation prepare(Long memberId, Long orderId) {
        if (memberId == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
        if (orderId == null || orderId <= 0)
            throw new BusinessException(ErrorCode.INVALID_INPUT);

        // 회원 정지와 사용자 결제 준비를 직렬화한다. 재고 보호는 주문·상품 잠금이 담당한다.
        var member = members.findByIdForUpdate(memberId)
                .orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_REQUIRED));
        if (member.getStatus() != MemberStatus.ACTIVE)
            throw new BusinessException(ErrorCode.MEMBER_SUSPENDED);
        var order = orders.findByIdAndMemberIdForUpdate(orderId, memberId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND));

        // 새로고침·새 탭의 요청도 주문에 저장된 같은 결제 정보를 반환한다.
        var existing = payments.findByOrderId(orderId);
        if (existing.isPresent() && existing.get().isKeepOrderOnRelease() && "CREATED".equals(order.getStatus())
                && "RELEASED".equals(stock.snapshot(order).status())) {
            var reservation = stock.reserveAgain(order);
            existing.get().retire();
            payments.flush();
            var payment = payments.saveAndFlush(Payment.ready(order));
            return new Preparation(PreparePaymentResponse.from(payment, reservation), true);
        }
        if (existing.isPresent()) {
            var state = stock.snapshot(order);
            if ("CREATED".equals(order.getStatus()) && existing.get().isKeepOrderOnRelease()
                    && java.util.Set.of("RELEASE_PENDING", "REVIEW_REQUIRED").contains(state.status()))
                return new Preparation(PreparePaymentResponse.from(existing.get(), state), false);
            var reservation = stock.prepare(order, true);
            return new Preparation(PreparePaymentResponse.from(existing.get(), reservation), false);
        }

        if (!"CREATED".equals(order.getStatus()) || order.getItems().isEmpty()
                || order.getTotalAmount() < 0 || order.getTotalAmount() > 9_007_199_254_740_991L)
            throw new BusinessException(ErrorCode.PAYMENT_ORDER_NOT_PAYABLE);

        var reservation = stock.prepare(order, false);
        var payment = payments.saveAndFlush(Payment.ready(order));
        return new Preparation(PreparePaymentResponse.from(payment, reservation), true);
    }
}
