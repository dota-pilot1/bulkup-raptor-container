package com.bulkup.raptor.auth.application.service;

import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.domain.MemberStatus;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.role.repository.RoleRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChangeMemberRoleService {
    private final MemberRepository memberRepository;
    private final RoleRepository roleRepository;

    @Transactional
    public Member changeRole(Long actorId, Long targetId, Long roleId) {
        if (roleId == null) throw new BusinessException(ErrorCode.INVALID_INPUT);
        return changeRoles(actorId, targetId, Set.of(roleId));
    }

    @Transactional
    public Member changeRoles(Long actorId, Long targetId, Set<Long> roleIds) {
        if (roleIds == null
                || roleIds.isEmpty()
                || roleIds.stream().anyMatch(id -> id == null || id <= 0))
            throw new BusinessException(ErrorCode.INVALID_INPUT);
        List<Member> members = memberRepository.lockRoleChangeMembers(actorId, targetId);
        Member actor =
                members.stream()
                        .filter(m -> m.getId().equals(actorId))
                        .findFirst()
                        .orElseThrow(() -> new BusinessException(ErrorCode.ADMIN_REQUIRED));
        // 잠금을 얻은 뒤 DB의 현재 권한을 확인하여 동시에 강등된 ADMIN의 요청도 거부한다.
        if (!actor.hasRole("ADMIN") || actor.getStatus() != MemberStatus.ACTIVE) {
            throw new BusinessException(ErrorCode.ADMIN_REQUIRED);
        }
        Member target =
                members.stream()
                        .filter(m -> m.getId().equals(targetId))
                        .findFirst()
                        .orElseThrow(() -> new BusinessException(ErrorCode.MEMBER_NOT_FOUND));
        var selected = roleRepository.lockAllByIds(roleIds);
        if (selected.size() != roleIds.size())
            throw new BusinessException(ErrorCode.ROLE_NOT_FOUND);
        var currentIds =
                target.getRoles().stream().map(role -> role.getId()).collect(Collectors.toSet());
        if (currentIds.equals(roleIds)) return target;
        if (actorId.equals(targetId)) throw new BusinessException(ErrorCode.SELF_ROLE_CHANGE);
        // 현재 ADMIN인 요청자를 잠근 상태로 유지하고 자기 강등을 금지하므로
        // 마지막 ADMIN도 보존된다. 전체 관리자 목록을 잠그거나 셀 필요가 없다.
        // 역할과 세션 버전은 한 트랜잭션에서 저장된다. 롤백 시 로그인도 유지된다.
        target.changeRoles(selected);
        return target;
    }
}
