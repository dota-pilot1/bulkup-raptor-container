package com.bulkup.raptor.payment.domain;

// 결제 준비와 서버 검증 완료 상태를 구분한다.
public enum PaymentStatus {
    READY, PAID, RETIRED, CANCELLED
}
