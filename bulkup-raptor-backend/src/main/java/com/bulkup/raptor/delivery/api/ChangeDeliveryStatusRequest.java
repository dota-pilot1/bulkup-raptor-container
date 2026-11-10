package com.bulkup.raptor.delivery.api;

import com.bulkup.raptor.delivery.domain.DeliveryStatus;
import jakarta.validation.constraints.*;

public record ChangeDeliveryStatusRequest(
        @NotNull DeliveryStatus status,
        @NotNull @Min(0) Long expectedVersion,
        @Size(max = 500) String reason) {}
