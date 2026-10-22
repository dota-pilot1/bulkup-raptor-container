package com.bulkup.raptor.admin.api;

import jakarta.validation.constraints.*;

import java.util.Set;

public record AdminRolePermissionRequest(@NotNull Set<@NotNull @Positive Long> permissionIds) {}
