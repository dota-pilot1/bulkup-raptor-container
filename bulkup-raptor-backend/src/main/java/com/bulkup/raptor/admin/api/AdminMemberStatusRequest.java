package com.bulkup.raptor.admin.api;

import com.bulkup.raptor.auth.domain.MemberStatus;
import jakarta.validation.constraints.NotNull;

public record AdminMemberStatusRequest(
        @NotNull(message = "회원 상태는 필수입니다.")
        MemberStatus status
) {
}
