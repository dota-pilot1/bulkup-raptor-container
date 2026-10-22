package com.bulkup.raptor.admin.api;

import jakarta.validation.constraints.*;

public record AdminPermissionUpdateRequest(
        @NotBlank @Size(max = 80) String name,
        @Size(max = 500) String description,
        @Positive Long categoryId) {}
