package com.bulkup.raptor.cart.api;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record AddCartItemRequest(
        @NotNull @Positive Long productId,
        @NotNull @DecimalMin("1") @DecimalMax("99") @Digits(integer = 2, fraction = 0)
        BigDecimal quantity) {}
