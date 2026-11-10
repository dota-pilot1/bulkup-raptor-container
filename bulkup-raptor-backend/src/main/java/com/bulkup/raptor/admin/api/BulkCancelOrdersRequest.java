package com.bulkup.raptor.admin.api;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record BulkCancelOrdersRequest(
        @NotNull @NotEmpty @Size(max = 50) List<@NotNull Long> orderIds,
        @Size(max = 200) String reason) {}
