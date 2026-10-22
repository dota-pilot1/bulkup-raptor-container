package com.bulkup.raptor.admin.api;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.Set;

public record AdminMemberRolesRequest(@NotEmpty Set<@NotNull @Positive Long> roleIds) {}
