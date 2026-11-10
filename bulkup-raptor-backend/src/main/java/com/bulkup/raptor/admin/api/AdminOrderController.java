package com.bulkup.raptor.admin.api;

import com.bulkup.raptor.admin.application.service.AdminOrderQueryService;
import com.bulkup.raptor.order.api.CancelOrderRequest;
import com.bulkup.raptor.order.application.service.OrderCancellationService;
import com.bulkup.raptor.order.application.service.OrderCancellationService.SelectedCancellation;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/orders")
@RequiredArgsConstructor
public class AdminOrderController {
    private final AdminOrderQueryService orders;
    private final OrderCancellationService orderCancellations;

    @PostMapping("/cancellations")
    public BulkCancellationResponse cancelSelected(
            @AuthenticationPrincipal Long memberId, @Valid @RequestBody BulkCancelOrdersRequest request) {
        List<SelectedCancellation> results = orderCancellations.cancelSelectedAsAdmin(memberId, request.orderIds(), request.reason());
        return new BulkCancellationResponse(results.stream()
                .map(item -> new BulkCancellationResponse.Item(item.orderId(), item.succeeded(), item.orderStatus(), item.pending(), item.code(), item.message()))
                .toList());
    }

    @PostMapping("/{orderId}/cancel")
    public ResponseEntity<com.bulkup.raptor.payment.application.service.CancelUnpaidPaymentService.Result> cancel(
            @AuthenticationPrincipal Long memberId, @PathVariable @Min(1) Long orderId,
            @Valid @RequestBody(required = false) CancelOrderRequest request) {
        var result = orderCancellations.cancelAsAdmin(memberId, orderId, request == null ? null : request.reason());
        return ResponseEntity.status(result.pending() ? 202 : 200).body(result);
    }

    @GetMapping
    public AdminOrderPageResponse list(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size,
            @RequestParam(defaultValue = "") @Size(max = 100) String search,
            @RequestParam(required = false) AdminOrderStatus status,
            @RequestParam(defaultValue = "false") boolean cancellable) {
        return orders.list(page, size, search, status, cancellable);
    }

    @GetMapping("/{orderId}")
    public AdminOrderDetailResponse get(@PathVariable @Min(1) Long orderId) {
        return orders.get(orderId);
    }
}
