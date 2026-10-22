package com.bulkup.raptor.admin.api;

import jakarta.validation.constraints.*;

public record AdminRoleUpdateRequest(
        @NotBlank @Size(max = 80) String name, @Size(max = 500) String description) {}
