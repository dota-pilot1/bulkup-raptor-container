package com.bulkup.raptor.order.api;

import com.bulkup.raptor.order.application.service.OrderService;
import jakarta.validation.Valid;
import java.net.URI;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {
    private final OrderService orders;

    @PostMapping
    public ResponseEntity<OrderResponse> create(@AuthenticationPrincipal Long memberId,
            @Valid @RequestBody CreateOrderRequest request) {
        var result = orders.create(memberId, request);
        return result.created()
                ? ResponseEntity.created(URI.create("/api/orders/" + result.order().orderId())).body(result.order())
                : ResponseEntity.ok(result.order());
    }

    @GetMapping
    public OrderPageResponse list(@AuthenticationPrincipal Long memberId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status) {
        return orders.list(memberId, page, size, status);
    }

    @GetMapping("/{orderId}")
    public OrderResponse get(@AuthenticationPrincipal Long memberId, @PathVariable Long orderId) {
        return orders.get(memberId, orderId);
    }
}
