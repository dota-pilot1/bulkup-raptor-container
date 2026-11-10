package com.bulkup.raptor.admin.api;

import com.bulkup.raptor.admin.application.service.AdminPaymentQueryService;
import com.bulkup.raptor.payment.domain.PaymentStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/payments")
@RequiredArgsConstructor
public class AdminPaymentController {
    private final AdminPaymentQueryService payments;

    @GetMapping
    public AdminPaymentPageResponse list(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size,
            @RequestParam(defaultValue = "") @Size(max = 100) String search,
            @RequestParam(required = false) PaymentStatus status,
            @RequestParam(required = false) Boolean webhookVerified) {
        return payments.list(page, size, search, status, webhookVerified);
    }
}
