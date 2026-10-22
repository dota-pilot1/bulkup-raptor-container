package com.bulkup.raptor.role.application.service;

import com.bulkup.raptor.auth.domain.MemberStatus;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.*;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AdminRbacGuard {
    private final MemberRepository members;

    // Every command locks its actor before locking role/permission rows.
    public void requireAdmin(Long actorId) {
        var actor =
                members.findByIdForUpdate(actorId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.ADMIN_REQUIRED));
        if (!actor.hasRole("ADMIN") || actor.getStatus() != MemberStatus.ACTIVE)
            throw new BusinessException(ErrorCode.ADMIN_REQUIRED);
    }
}
