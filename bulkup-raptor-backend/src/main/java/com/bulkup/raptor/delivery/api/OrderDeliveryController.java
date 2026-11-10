package com.bulkup.raptor.delivery.api;

import com.bulkup.raptor.delivery.application.service.DeliveryService;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/orders/{orderId}/delivery")
@RequiredArgsConstructor
public class OrderDeliveryController {
    private final DeliveryService service;

    @GetMapping
    public DeliveryResponses.CustomerDetail get(@AuthenticationPrincipal Long memberId,
            @PathVariable @Min(1) Long orderId) {
        return service.getForOrder(memberId, orderId);
    }
}
