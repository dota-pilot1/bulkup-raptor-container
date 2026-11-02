package com.bulkup.raptor.payment.api;

import com.bulkup.raptor.payment.application.service.PreparePaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/orders/{orderId}/payments")
@RequiredArgsConstructor
public class PaymentController {
    private final PreparePaymentService payments;

    @PostMapping
    public ResponseEntity<PreparePaymentResponse> prepare(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long orderId) {
        var result = payments.prepare(memberId, orderId);
        return ResponseEntity.status(result.created() ? 201 : 200).body(result.payment());
    }
}
