package com.bulkup.raptor.auth.api;

import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.domain.MemberStatus;
import com.bulkup.raptor.permission.domain.Permission;

import java.util.List;

public record MemberSessionResponse(
        Long id,
        String email,
        String name,
        MemberStatus status,
        List<MemberRoleResponse> roles,
        List<String> permissions,
        List<MemberPermissionResponse> permissionDetails) {
    public static MemberSessionResponse from(Member member, List<Permission> permissions) {
        return new MemberSessionResponse(
                member.getId(),
                member.getEmail(),
                member.getName(),
                member.getStatus(),
                MemberRoleResponse.from(member.getRoles()),
                permissions.stream().map(Permission::getCode).toList(),
                permissions.stream().map(MemberPermissionResponse::from).toList());
    }
}
