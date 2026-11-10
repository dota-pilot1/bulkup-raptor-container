package com.bulkup.raptor.inventory.api;

import java.util.List;

public record StockAdjustmentPageResponse(List<StockAdjustmentResponse> content,
        int page, int size, long totalElements, int totalPages) {}
