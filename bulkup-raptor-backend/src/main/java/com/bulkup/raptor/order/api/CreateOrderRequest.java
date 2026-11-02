package com.bulkup.raptor.order.api;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CreateOrderRequest(
        @NotEmpty @Size(max = 100) List<@NotNull @Positive Long> cartItemIds,
        @NotBlank @Size(max = 80) String recipientName,
        @NotBlank @Pattern(regexp = "[0-9+() -]{8,30}") String phone,
        @NotBlank @Pattern(regexp = "[0-9]{5}") String postalCode,
        @NotBlank @Size(max = 200) String address,
        @NotNull @Size(max = 200) String addressDetail,
        @NotNull @PositiveOrZero @Digits(integer = 15, fraction = 0) BigDecimal expectedTotalAmount,
        @NotNull UUID requestId) {}
