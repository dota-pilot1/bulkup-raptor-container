package com.bulkup.raptor.admin.application.service;

import com.bulkup.raptor.admin.application.model.MemberSummary;
import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.domain.MemberStatus;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminMemberCommandService {

    private final MemberRepository memberRepository;

    @Transactional
    public MemberSummary updateMemberStatus(Long id, MemberStatus status) {
        Member member =
                memberRepository
                        .findByIdForUpdate(id)
                        .orElseThrow(() -> new BusinessException(ErrorCode.MEMBER_NOT_FOUND));

        member.updateStatus(status);
        return new MemberSummary(
                member.getId(),
                member.getEmail(),
                member.getName(),
                member.getStatus(),
                member.isEmailVerified(),
                member.getCreatedAt(),
                com.bulkup.raptor.auth.api.MemberRoleResponse.from(member.getRoles()));
    }
}
