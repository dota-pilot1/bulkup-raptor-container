package com.bulkup.raptor.auth.api;

import com.bulkup.raptor.auth.application.service.DefaultDeliveryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth/me/default-delivery")
@RequiredArgsConstructor
public class DefaultDeliveryController {
    private final DefaultDeliveryService deliveries;

    @GetMapping
    public ResponseEntity<DefaultDeliveryResponse> get(@AuthenticationPrincipal Long memberId) {
        var delivery = deliveries.get(memberId);
        return delivery == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(delivery);
    }

    @PutMapping
    public DefaultDeliveryResponse save(@AuthenticationPrincipal Long memberId,
            @Valid @RequestBody DefaultDeliveryRequest request) {
        return deliveries.save(memberId, request);
    }
}
