package com.bulkup.raptor.inventory.application.model;

import com.bulkup.raptor.inventory.domain.StockAdjustmentType;
import java.time.Instant;

public record StockAdjustmentRow(Long id, Long productId, Long actorId, String actorName,
        StockAdjustmentType type, int delta, int beforeQuantity, int afterQuantity,
        String reason, Instant createdAt, Long orderId, String cause) {}
