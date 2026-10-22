package com.bulkup.raptor.admin.api;

import jakarta.validation.constraints.*;

public record AdminPermissionCategoryCreateRequest(
        @NotBlank @Pattern(regexp = "[A-Z][A-Z0-9_]{1,63}") String code,
        @NotBlank @Size(max = 80) String name,
        @Size(max = 500) String description,
        @NotNull @Min(0) Integer sortOrder) {}
