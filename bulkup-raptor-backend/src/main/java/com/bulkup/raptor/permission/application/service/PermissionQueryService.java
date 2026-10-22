package com.bulkup.raptor.permission.application.service;

import com.bulkup.raptor.admin.api.AdminPermissionResponse;
import com.bulkup.raptor.common.error.*;
import com.bulkup.raptor.permission.repository.PermissionRepository;
import com.bulkup.raptor.role.repository.RolePermissionRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PermissionQueryService {
    private final PermissionRepository permissions;
    private final RolePermissionRepository links;
    private final com.bulkup.raptor.permission.repository.PermissionCategoryRepository categories;

    public List<AdminPermissionResponse> list(Long categoryId, String q) {
        if (categoryId != null && !categories.existsById(categoryId))
            throw new BusinessException(ErrorCode.PERMISSION_CATEGORY_NOT_FOUND);
        String pattern =
                "%"
                        + (q == null
                                ? ""
                                : q.trim()
                                        .toLowerCase(java.util.Locale.ROOT)
                                        .replace("!", "!!")
                                        .replace("%", "!%")
                                        .replace("_", "!_"))
                        + "%";
        var selected = permissions.search(categoryId, pattern);
        if (selected.isEmpty()) return List.of();
        var grouped =
                links.findPermissionLinks(selected.stream().map(p -> p.getId()).toList()).stream()
                        .collect(
                                Collectors.groupingBy(
                                        l -> l.getPermission().getId(),
                                        Collectors.mapping(
                                                l ->
                                                        new AdminPermissionResponse.RoleReference(
                                                                l.getRole().getId(),
                                                                l.getRole().getCode(),
                                                                l.getRole().getName()),
                                                Collectors.toList())));
        return selected.stream()
                .map(
                        p ->
                                AdminPermissionResponse.from(
                                        p, grouped.getOrDefault(p.getId(), List.of())))
                .toList();
    }

    public AdminPermissionResponse get(Long id) {
        var p =
                permissions
                        .findById(id)
                        .orElseThrow(() -> new BusinessException(ErrorCode.PERMISSION_NOT_FOUND));
        var roles =
                links.findPermissionRoles(id).stream()
                        .map(
                                l ->
                                        new AdminPermissionResponse.RoleReference(
                                                l.getRole().getId(),
                                                l.getRole().getCode(),
                                                l.getRole().getName()))
                        .toList();
        return AdminPermissionResponse.from(p, roles);
    }
}
