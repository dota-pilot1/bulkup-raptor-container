package com.bulkup.raptor.role.application.service;

import com.bulkup.raptor.admin.api.*;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.*;
import com.bulkup.raptor.role.domain.*;
import com.bulkup.raptor.role.repository.*;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RoleQueryService {
    private final RoleRepository roles;
    private final RolePermissionRepository links;
    private final MemberRepository members;

    public List<AdminRoleResponse> list() {
        return responses(roles.findAllByOrderByIdAsc());
    }

    public AdminRoleResponse get(Long id) {
        return responses(
                        List.of(
                                roles.findById(id)
                                        .orElseThrow(
                                                () ->
                                                        new BusinessException(
                                                                ErrorCode.ROLE_NOT_FOUND))))
                .getFirst();
    }

    private List<AdminRoleResponse> responses(List<Role> selected) {
        if (selected.isEmpty()) return List.of();
        var ids = selected.stream().map(Role::getId).toList();
        var grouped =
                links.findLinks(ids).stream()
                        .collect(Collectors.groupingBy(l -> l.getRole().getId()));
        var memberCounts =
                members.countRoleMembers(ids).stream()
                        .collect(
                                Collectors.toMap(
                                        MemberRepository.RoleMemberCount::getRoleId,
                                        MemberRepository.RoleMemberCount::getTotal));
        var permissionCounts =
                links.permissionRoleCounts().stream()
                        .collect(
                                Collectors.toMap(
                                        RolePermissionRepository.PermissionRoleCount
                                                ::getPermissionId,
                                        RolePermissionRepository.PermissionRoleCount::getTotal));
        return selected.stream()
                .map(
                        r ->
                                new AdminRoleResponse(
                                        r.getId(),
                                        r.getCode(),
                                        r.getName(),
                                        r.getDescription(),
                                        r.isSystemRole(),
                                        r.getPermissionVersion(),
                                        grouped.getOrDefault(r.getId(), List.of()).stream()
                                                .map(
                                                        l ->
                                                                AdminPermissionResponse.from(
                                                                        l.getPermission(),
                                                                        permissionCounts
                                                                                .getOrDefault(
                                                                                        l.getPermission()
                                                                                                .getId(),
                                                                                        0L)))
                                                .toList(),
                                        memberCounts.getOrDefault(r.getId(), 0L)))
                .toList();
    }
}
