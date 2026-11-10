package com.bulkup.raptor.inventory.api;

import com.bulkup.raptor.inventory.application.service.StockAdjustmentQueryService;
import com.bulkup.raptor.inventory.application.service.StockAdjustmentCommandService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/products/{productId}/stock-adjustments")
@RequiredArgsConstructor
public class StockAdjustmentController {
    private final StockAdjustmentQueryService adjustments;
    private final StockAdjustmentCommandService commands;

    @Operation(summary = "상품 재고 증감과 변경 이력 저장")
    @PostMapping
    public ResponseEntity<StockAdjustmentResponse> create(
            @PathVariable @Min(1) Long productId,
            @AuthenticationPrincipal Long memberId,
            @Valid @RequestBody StockAdjustmentRequest request) {
        return ResponseEntity.status(201).body(commands.create(productId, memberId, request));
    }

    @Operation(summary = "상품별 재고 변경 이력 조회")
    @GetMapping
    public StockAdjustmentPageResponse list(
            @PathVariable @Min(1) Long productId,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return adjustments.list(productId, page, size);
    }
}
