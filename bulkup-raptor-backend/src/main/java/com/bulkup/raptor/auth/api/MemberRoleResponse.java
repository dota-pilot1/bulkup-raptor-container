package com.bulkup.raptor.auth.api;

import com.bulkup.raptor.role.domain.Role;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;

public record MemberRoleResponse(Long id, String code, String name) {
    public static List<MemberRoleResponse> from(Collection<Role> roles) {
        return roles.stream()
                .sorted(Comparator.comparing(Role::getCode))
                .map(role -> new MemberRoleResponse(role.getId(), role.getCode(), role.getName()))
                .toList();
    }
}
