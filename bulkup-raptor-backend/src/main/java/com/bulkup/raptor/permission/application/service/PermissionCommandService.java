package com.bulkup.raptor.permission.application.service;

import com.bulkup.raptor.common.error.*;
import com.bulkup.raptor.permission.domain.Permission;
import com.bulkup.raptor.permission.repository.PermissionRepository;
import com.bulkup.raptor.role.application.service.AdminRbacGuard;
import com.bulkup.raptor.role.repository.RolePermissionRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class PermissionCommandService {
    private final PermissionRepository permissions;
    private final RolePermissionRepository links;
    private final AdminRbacGuard guard;
    private final com.bulkup.raptor.permission.repository.PermissionCategoryRepository categories;

    public Long create(Long actor, String code, String name, String description, Long categoryId) {
        guard.requireAdmin(actor);
        if (permissions.existsByCode(code))
            throw new BusinessException(ErrorCode.RBAC_DUPLICATE_CODE);
        return permissions
                .saveAndFlush(Permission.create(code, name, description, category(categoryId)))
                .getId();
    }

    public void update(Long actor, Long id, String name, String description, Long categoryId) {
        guard.requireAdmin(actor);
        var permission = lock(id);
        permission.rename(name, description);
        if (categoryId != null) permission.moveTo(category(categoryId));
    }

    public void delete(Long actor, Long id) {
        guard.requireAdmin(actor);
        var permission = lock(id);
        if (permission.isSystemPermission())
            throw new BusinessException(ErrorCode.RBAC_SYSTEM_PROTECTED);
        if (links.existsByPermissionId(id)) throw new BusinessException(ErrorCode.RBAC_IN_USE);
        permissions.delete(permission);
    }

    private com.bulkup.raptor.permission.domain.PermissionCategory category(Long id) {
        // Older clients omit categoryId; new permissions then use OTHER.
        if (id == null) {
            var other = categories.findByCode("OTHER");
            if (other.isEmpty()) throw new BusinessException(ErrorCode.INVALID_INPUT);
            id = other.get().getId();
        }
        return categories
                .lockById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.PERMISSION_CATEGORY_NOT_FOUND));
    }

    private Permission lock(Long id) {
        return permissions
                .lockById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.PERMISSION_NOT_FOUND));
    }
}
