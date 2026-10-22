package com.bulkup.raptor.admin.api;

import jakarta.validation.constraints.*;

public record AdminPermissionCategoryUpdateRequest(
        @NotBlank @Size(max = 80) String name,
        @Size(max = 500) String description,
        @NotNull @Min(0) Integer sortOrder) {}
