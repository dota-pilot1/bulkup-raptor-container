package com.bulkup.raptor.admin.api;

import jakarta.validation.constraints.*;

public record AdminMemberRoleRequest(@NotNull @Positive Long roleId) {}
