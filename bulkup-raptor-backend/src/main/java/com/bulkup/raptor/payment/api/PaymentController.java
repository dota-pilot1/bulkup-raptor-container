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
    private final com.bulkup.raptor.payment.application.service.CancelUnpaidPaymentService cancellations;
    private final com.bulkup.raptor.order.application.service.OrderCancellationService orderCancellations;

    @PostMapping("/cancel")
    public ResponseEntity<com.bulkup.raptor.payment.application.service.CancelUnpaidPaymentService.Result> cancel(
            @AuthenticationPrincipal Long memberId, @PathVariable Long orderId,
            @jakarta.validation.Valid @RequestBody(required = false) com.bulkup.raptor.order.api.CancelOrderRequest request) {
        var result = orderCancellations.cancel(memberId, orderId, request == null ? null : request.reason());
        return ResponseEntity.status(result.pending() ? 202 : 200).body(result);
    }

    @PostMapping("/release-reservation")
    public ResponseEntity<com.bulkup.raptor.payment.application.service.CancelUnpaidPaymentService.Result> releaseReservation(
            @AuthenticationPrincipal Long memberId, @PathVariable Long orderId) {
        var result = cancellations.releaseReservation(memberId, orderId);
        return ResponseEntity.status(result.pending() ? 202 : 200).body(result);
    }

    @PostMapping
    public ResponseEntity<PreparePaymentResponse> prepare(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long orderId) {
        var result = payments.prepare(memberId, orderId);
        return ResponseEntity.status(result.created() ? 201 : 200).body(result.payment());
    }
}
