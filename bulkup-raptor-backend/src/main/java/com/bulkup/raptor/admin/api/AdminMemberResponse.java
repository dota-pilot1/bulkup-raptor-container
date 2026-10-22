package com.bulkup.raptor.admin.api;

import com.bulkup.raptor.admin.application.model.MemberSummary;
import com.bulkup.raptor.auth.api.MemberRoleResponse;
import com.bulkup.raptor.auth.domain.MemberStatus;

import java.time.Instant;
import java.util.List;

public record AdminMemberResponse(
        Long id,
        String email,
        String name,
        MemberStatus status,
        boolean emailVerified,
        Instant createdAt,
        List<MemberRoleResponse> roles) {
    public static AdminMemberResponse from(MemberSummary member) {
        return new AdminMemberResponse(
                member.id(),
                member.email(),
                member.name(),
                member.status(),
                member.emailVerified(),
                member.createdAt(),
                member.roles());
    }
}
