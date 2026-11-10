package com.bulkup.raptor.inventory.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.annotation.JsonDeserialize;

public record StockAdjustmentRequest(
        @NotNull @JsonDeserialize(using = StockAdjustmentDeltaDeserializer.class) Integer delta,
        @NotBlank @Size(max = 200) String reason) {
    public StockAdjustmentRequest {
        reason = reason == null ? null : reason.trim();
    }
}
