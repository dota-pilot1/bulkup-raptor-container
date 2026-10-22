package com.bulkup.raptor.admin.application.model;

import com.bulkup.raptor.auth.api.MemberRoleResponse;
import com.bulkup.raptor.auth.domain.MemberStatus;

import java.time.Instant;
import java.util.List;

public record MemberSummary(
        Long id,
        String email,
        String name,
        MemberStatus status,
        boolean emailVerified,
        Instant createdAt,
        List<MemberRoleResponse> roles) {
    public MemberSummary(
            Long id,
            String email,
            String name,
            MemberStatus status,
            boolean emailVerified,
            Instant createdAt) {
        this(id, email, name, status, emailVerified, createdAt, List.of());
    }

    public MemberSummary withRoles(List<MemberRoleResponse> selected) {
        return new MemberSummary(
                id, email, name, status, emailVerified, createdAt, List.copyOf(selected));
    }
}
