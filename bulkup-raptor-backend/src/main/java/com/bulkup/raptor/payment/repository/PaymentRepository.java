package com.bulkup.raptor.payment.repository;

import com.bulkup.raptor.payment.domain.Payment;
import com.bulkup.raptor.payment.domain.PaymentStatus;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRepository extends JpaRepository<Payment, String> {
    // 주문당 하나인 결제 정보를 준비 요청과 검증 요청에서 함께 사용한다.
    Optional<Payment> findByOrderId(Long orderId);

    // 같은 주문에 이미 완료된 결제가 있는지 확인할 때 사용한다.
    boolean existsByOrderIdAndStatus(Long orderId, PaymentStatus status);
}
