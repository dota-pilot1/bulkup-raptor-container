package com.bulkup.raptor.payment.api;

import com.bulkup.raptor.payment.application.service.VerifyPaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

// 회원 ID는 로그인 세션에서 받으며, 결제 조회와 완료 처리는 서비스에 맡긴다.
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class PaymentVerificationController {
    private final VerifyPaymentService payments;

    // 결제 결과를 검증하고, 결제와 주문을 완료 상태로 변경한다.
    @PostMapping("/orders/{orderId}/payments/{paymentId}/verify")
    public VerifyPaymentResponse verify(@AuthenticationPrincipal Long memberId,
            @PathVariable Long orderId, @PathVariable String paymentId) {
        return payments.verify(memberId, orderId, paymentId);
    }

    // 화면에 결제 ID가 없으면, 주문에 저장된 결제를 찾아 검증한다.
    @PostMapping("/orders/{orderId}/payments/verify")
    public VerifyPaymentResponse recover(@AuthenticationPrincipal Long memberId, @PathVariable Long orderId) {
        return payments.verify(memberId, orderId, null); // 결제 ID는 서비스에서 찾는다.
    }

    // 휴대폰 결제 후 우리 사이트로 돌아오면, 결제 ID로 결과를 확인한다.
    @PostMapping("/payments/{paymentId}/verify")
    public VerifyPaymentResponse redirect(@AuthenticationPrincipal Long memberId, @PathVariable String paymentId) {
        return payments.verify(memberId, null, paymentId); // 주문 ID는 저장된 결제에서 찾는다.
    }
}
