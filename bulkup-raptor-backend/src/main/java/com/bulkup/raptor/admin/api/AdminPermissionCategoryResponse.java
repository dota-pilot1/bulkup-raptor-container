package com.bulkup.raptor.admin.api;

import com.bulkup.raptor.permission.domain.PermissionCategory;

public record AdminPermissionCategoryResponse(
        Long id,
        String code,
        String name,
        String description,
        int sortOrder,
        long permissionCount) {
    public static AdminPermissionCategoryResponse from(PermissionCategory c, long count) {
        return new AdminPermissionCategoryResponse(
                c.getId(), c.getCode(), c.getName(), c.getDescription(), c.getSortOrder(), count);
    }
}
