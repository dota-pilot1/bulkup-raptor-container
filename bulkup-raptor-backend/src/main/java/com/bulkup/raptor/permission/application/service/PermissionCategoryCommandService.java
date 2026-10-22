package com.bulkup.raptor.permission.application.service;

import com.bulkup.raptor.common.error.*;
import com.bulkup.raptor.permission.domain.PermissionCategory;
import com.bulkup.raptor.permission.repository.*;
import com.bulkup.raptor.role.application.service.AdminRbacGuard;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class PermissionCategoryCommandService {
    private final PermissionCategoryRepository categories;
    private final PermissionRepository permissions;
    private final AdminRbacGuard guard;

    public Long create(Long actor, String code, String name, String description, int sortOrder) {
        guard.requireAdmin(actor);
        if (categories.existsByCode(code))
            throw new BusinessException(ErrorCode.RBAC_DUPLICATE_CODE);
        return categories
                .saveAndFlush(PermissionCategory.create(code, name, description, sortOrder))
                .getId();
    }

    public void update(Long actor, Long id, String name, String description, int sortOrder) {
        guard.requireAdmin(actor);
        lock(id).update(name, description, sortOrder);
    }

    public void delete(Long actor, Long id) {
        guard.requireAdmin(actor);
        var category = lock(id);
        if (permissions.existsByCategoryId(id))
            throw new BusinessException(ErrorCode.PERMISSION_CATEGORY_IN_USE);
        categories.delete(category);
    }

    private PermissionCategory lock(Long id) {
        return categories
                .lockById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.PERMISSION_CATEGORY_NOT_FOUND));
    }
}
