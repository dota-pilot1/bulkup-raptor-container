package com.bulkup.raptor.role.application.service;

import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.*;
import com.bulkup.raptor.permission.domain.Permission;
import com.bulkup.raptor.permission.repository.PermissionRepository;
import com.bulkup.raptor.role.domain.*;
import com.bulkup.raptor.role.repository.*;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class RoleCommandService {
    private static final Set<String> ADMIN_ONLY =
            Set.of("MEMBER_MANAGE", "MEMBER_ROLE_ASSIGN", "ROLE_MANAGE", "PERMISSION_MANAGE");
    private static final Set<String> OPERATOR_PERMISSIONS =
            Set.of("MENU_ADMIN_ACCESS", "PRODUCT_MANAGE", "ORDER_MANAGE", "SHIPPING_MANAGE");
    private final RoleRepository roles;
    private final PermissionRepository permissions;
    private final RolePermissionRepository links;
    private final MemberRepository members;
    private final AdminRbacGuard guard;

    public Long create(Long actor, String code, String name, String description, Set<Long> ids) {
        guard.requireAdmin(actor);
        if (roles.existsByCode(code)) throw new BusinessException(ErrorCode.RBAC_DUPLICATE_CODE);
        var selected = selectPermissions(ids);
        var role = roles.saveAndFlush(Role.create(code, name, description));
        for (var permission : selected) links.save(new RolePermission(role, permission));
        return role.getId();
    }

    public void update(Long actor, Long id, String name, String description) {
        guard.requireAdmin(actor);
        lock(id).rename(name, description);
    }

    public void replacePermissions(Long actor, Long id, Set<Long> ids) {
        guard.requireAdmin(actor);
        var role = lock(id);
        var current =
                links.findLinks(List.of(id)).stream()
                        .map(l -> l.getPermission().getId())
                        .collect(Collectors.toSet());
        if (current.equals(ids)) return;
        if (role.isSystemRole() && !"OPERATOR".equals(role.getCode()))
            throw new BusinessException(ErrorCode.RBAC_SYSTEM_PROTECTED);
        var selected = selectPermissions(ids);
        if ("OPERATOR".equals(role.getCode())
                && selected.stream().anyMatch(p -> !OPERATOR_PERMISSIONS.contains(p.getCode())))
            throw new BusinessException(ErrorCode.RBAC_OPERATOR_PERMISSION);
        // Remove only obsolete links; delete-and-reinsert the same managed PK is unsafe in JPA.
        for (var link : links.findLinks(List.of(id)))
            if (!ids.contains(link.getPermission().getId())) links.delete(link);
        for (var permission : selected)
            if (!current.contains(permission.getId()))
                links.save(new RolePermission(role, permission));
        role.permissionsChanged();
    }

    public void delete(Long actor, Long id) {
        guard.requireAdmin(actor);
        var role = lock(id);
        if (role.isSystemRole()) throw new BusinessException(ErrorCode.RBAC_SYSTEM_PROTECTED);
        if (members.countByRoleId(id) > 0) throw new BusinessException(ErrorCode.RBAC_IN_USE);
        links.deleteLinks(id);
        roles.delete(role);
    }

    private Role lock(Long id) {
        return roles.lockById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.ROLE_NOT_FOUND));
    }

    private List<Permission> selectPermissions(Set<Long> ids) {
        var selected = ids.isEmpty() ? List.<Permission>of() : permissions.lockAllByIds(ids);
        if (selected.size() != ids.size())
            throw new BusinessException(ErrorCode.PERMISSION_NOT_FOUND);
        if (selected.stream().anyMatch(p -> ADMIN_ONLY.contains(p.getCode())))
            throw new BusinessException(ErrorCode.RBAC_ADMIN_PERMISSION);
        return selected;
    }
}
