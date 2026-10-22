package com.bulkup.raptor.auth.api;

import com.bulkup.raptor.permission.domain.Permission;

public record MemberPermissionResponse(
        String code,
        String name,
        String description,
        String categoryCode,
        String categoryName,
        int categorySortOrder) {
    public static MemberPermissionResponse from(Permission permission) {
        var category = permission.getCategory();
        return new MemberPermissionResponse(
                permission.getCode(),
                permission.getName(),
                permission.getDescription(),
                category.getCode(),
                category.getName(),
                category.getSortOrder());
    }
}
