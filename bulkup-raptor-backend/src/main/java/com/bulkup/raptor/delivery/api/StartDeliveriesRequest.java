package com.bulkup.raptor.delivery.api;

import com.bulkup.raptor.delivery.domain.DeliveryStatus;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record StartDeliveriesRequest(
        @NotNull @NotEmpty @Size(max = 50) List<@NotNull Long> orderIds,
        DeliveryStatus status) {}
