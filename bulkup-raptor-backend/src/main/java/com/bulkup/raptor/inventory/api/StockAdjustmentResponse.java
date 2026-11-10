package com.bulkup.raptor.inventory.api;

import com.bulkup.raptor.inventory.application.model.StockAdjustmentRow;
import com.bulkup.raptor.inventory.domain.StockAdjustmentType;
import com.bulkup.raptor.inventory.domain.StockAdjustment;
import java.time.Instant;

public record StockAdjustmentResponse(Long id, Long productId, Long actorId, String actorName,
        StockAdjustmentType type, int delta, int beforeQuantity, int afterQuantity,
        String reason, Instant createdAt, Long orderId, String cause) {
    public static StockAdjustmentResponse from(StockAdjustment adjustment) {
        return new StockAdjustmentResponse(adjustment.getId(), adjustment.getProduct().getId(),
                adjustment.getActor().getId(), adjustment.getActor().getName(), adjustment.getType(),
                adjustment.getDelta(), adjustment.getBeforeQuantity(), adjustment.getAfterQuantity(),
                adjustment.getReason(), adjustment.getCreatedAt(), adjustment.getOrderId(), adjustment.getCause());
    }

    public static StockAdjustmentResponse from(StockAdjustmentRow row) {
        return new StockAdjustmentResponse(row.id(), row.productId(), row.actorId(), row.actorName(),
                row.type(), row.delta(), row.beforeQuantity(), row.afterQuantity(), row.reason(), row.createdAt(), row.orderId(), row.cause());
    }
}
