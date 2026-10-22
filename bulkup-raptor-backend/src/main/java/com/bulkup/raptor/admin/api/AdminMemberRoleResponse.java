package com.bulkup.raptor.admin.api;

import com.bulkup.raptor.auth.api.MemberRoleResponse;
import com.bulkup.raptor.auth.domain.Member;

import java.util.List;

public record AdminMemberRoleResponse(Long id, List<MemberRoleResponse> roles) {
    public static AdminMemberRoleResponse from(Member member) {
        return new AdminMemberRoleResponse(
                member.getId(), MemberRoleResponse.from(member.getRoles()));
    }
}
