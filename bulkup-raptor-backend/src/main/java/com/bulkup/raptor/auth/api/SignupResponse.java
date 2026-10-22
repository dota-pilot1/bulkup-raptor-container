package com.bulkup.raptor.auth.api;

import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.domain.MemberStatus;

public record SignupResponse(
    Long id,
    String email,
    String name,
    MemberStatus status,
    boolean emailVerified
) {
    public static SignupResponse from(Member member) {
        return new SignupResponse(member.getId(), member.getEmail(), member.getName(), member.getStatus(), member.isEmailVerified());
    }
}
