package com.bulkup.raptor.payment.application.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.domain.MemberStatus;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.order.domain.Order;
import com.bulkup.raptor.order.domain.OrderItem;
import com.bulkup.raptor.order.repository.OrderRepository;
import com.bulkup.raptor.payment.repository.PaymentRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class PreparePaymentServiceTest {
    final MemberRepository members = mock(MemberRepository.class);
    final OrderRepository orders = mock(OrderRepository.class);
    final PaymentRepository payments = mock(PaymentRepository.class);
    final PreparePaymentService service = new PreparePaymentService(members, orders, payments);

    @Test
    void rejectsAnonymousAndInvalidInputsBeforeReadingDatabase() {
        assertError(ErrorCode.LOGIN_REQUIRED, () -> service.prepare(null, 1L));
        assertError(ErrorCode.INVALID_INPUT, () -> service.prepare(1L, 0L));
        assertError(ErrorCode.INVALID_INPUT, () -> service.prepare(1L, null));
        verifyNoInteractions(members, orders, payments);
    }

    @Test
    void rejectsSuspendedMemberBeforeLoadingOrder() {
        var member = mock(Member.class);
        when(member.getStatus()).thenReturn(MemberStatus.SUSPENDED);
        when(members.findByIdForUpdate(1L)).thenReturn(Optional.of(member));
        assertError(ErrorCode.MEMBER_SUSPENDED, () -> service.prepare(1L, 2L));
        verifyNoInteractions(orders, payments);
    }

    @Test
    void rejectsNonPayableStateEmptyOrderAndAmountOutsideBrowserSafeIntegerRange() {
        var member = mock(Member.class);
        when(member.getStatus()).thenReturn(MemberStatus.ACTIVE);
        when(members.findByIdForUpdate(1L)).thenReturn(Optional.of(member));
        var order = mock(Order.class);
        when(orders.findByIdAndMemberIdForUpdate(2L, 1L)).thenReturn(Optional.of(order));
        when(order.getStatus()).thenReturn("PAID");
        assertError(ErrorCode.PAYMENT_ORDER_NOT_PAYABLE, () -> service.prepare(1L, 2L));
        when(order.getStatus()).thenReturn("CREATED");
        when(order.getItems()).thenReturn(List.of());
        assertError(ErrorCode.PAYMENT_ORDER_NOT_PAYABLE, () -> service.prepare(1L, 2L));
        when(order.getItems()).thenReturn(List.of(mock(OrderItem.class)));
        when(order.getTotalAmount()).thenReturn(9_007_199_254_740_992L);
        assertError(ErrorCode.PAYMENT_ORDER_NOT_PAYABLE, () -> service.prepare(1L, 2L));
        verify(payments, never()).saveAndFlush(any());
    }

    void assertError(ErrorCode code, Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(BusinessException.class,
                error -> org.assertj.core.api.Assertions.assertThat(error.getErrorCode()).isEqualTo(code));
    }
}
