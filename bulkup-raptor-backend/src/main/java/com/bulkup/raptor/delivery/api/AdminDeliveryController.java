package com.bulkup.raptor.delivery.api;

import com.bulkup.raptor.delivery.application.service.DeliveryService;
import com.bulkup.raptor.delivery.domain.DeliveryStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/deliveries")
@RequiredArgsConstructor
public class AdminDeliveryController {
    private final DeliveryService service;

    @PostMapping("/starts")
    public StartDeliveriesResponse start(@AuthenticationPrincipal Long actorId,
            @Valid @RequestBody StartDeliveriesRequest request) {
        var target = request.status() == null ? DeliveryStatus.OUT_FOR_DELIVERY : request.status();
        return new StartDeliveriesResponse(service.startSelected(actorId, request.orderIds(), target));
    }

    @GetMapping
    public DeliveryResponses.Page list(@RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size,
            @RequestParam(defaultValue = "") @Size(max = 100) String search,
            @RequestParam(required = false) DeliveryStatus status) {
        return service.list(page, size, search, status);
    }

    @GetMapping("/{deliveryId}")
    public DeliveryResponses.AdminDetail get(@PathVariable @Min(1) Long deliveryId) {
        return service.get(deliveryId);
    }

    @PatchMapping("/{deliveryId}/status")
    public DeliveryResponses.AdminDetail change(@AuthenticationPrincipal Long actorId,
            @PathVariable @Min(1) Long deliveryId, @Valid @RequestBody ChangeDeliveryStatusRequest request) {
        return service.changeStatus(actorId, deliveryId, request);
    }
}
