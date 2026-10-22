package com.bulkup.raptor.admin.api;

import java.util.List;

public record AdminRoleResponse(
        Long id,
        String code,
        String name,
        String description,
        boolean systemRole,
        long permissionVersion,
        List<AdminPermissionResponse> permissions,
        long memberCount) {}
