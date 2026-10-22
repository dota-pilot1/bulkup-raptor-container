package com.bulkup.raptor.admin.api;

import com.bulkup.raptor.permission.domain.Permission;

import java.util.List;

public record AdminPermissionResponse(
        Long id,
        String code,
        String name,
        String description,
        boolean systemPermission,
        Long categoryId,
        String categoryCode,
        String categoryName,
        long roleCount,
        List<RoleReference> roles) {
    public record RoleReference(Long id, String code, String name) {}

    public static AdminPermissionResponse from(Permission p, long count) {
        return new AdminPermissionResponse(
                p.getId(),
                p.getCode(),
                p.getName(),
                p.getDescription(),
                p.isSystemPermission(),
                p.getCategory().getId(),
                p.getCategory().getCode(),
                p.getCategory().getName(),
                count,
                List.of());
    }

    public static AdminPermissionResponse from(Permission p, List<RoleReference> roles) {
        return new AdminPermissionResponse(
                p.getId(),
                p.getCode(),
                p.getName(),
                p.getDescription(),
                p.isSystemPermission(),
                p.getCategory().getId(),
                p.getCategory().getCode(),
                p.getCategory().getName(),
                roles.size(),
                List.copyOf(roles));
    }
}
