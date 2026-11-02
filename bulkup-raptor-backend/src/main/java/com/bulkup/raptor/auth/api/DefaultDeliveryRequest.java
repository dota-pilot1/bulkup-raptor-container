package com.bulkup.raptor.auth.api;

import jakarta.validation.constraints.*;

public record DefaultDeliveryRequest(
        @NotBlank @Size(max = 80) String recipientName,
        @NotBlank @Pattern(regexp = "[0-9+() -]{8,30}") String phone,
        @NotBlank @Pattern(regexp = "[0-9]{5}") String postalCode,
        @NotBlank @Size(max = 200) String address,
        @NotNull @Size(max = 200) String addressDetail) {}
