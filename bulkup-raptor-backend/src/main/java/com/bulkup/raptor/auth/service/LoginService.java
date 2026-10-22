package com.bulkup.raptor.auth.service;

import com.bulkup.raptor.auth.api.LoginRequest;
import com.bulkup.raptor.auth.api.MemberSessionResponse;
import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.domain.MemberStatus;
import com.bulkup.raptor.auth.infrastructure.session.MemberSessionDetails;
import com.bulkup.raptor.auth.infrastructure.session.RoleState;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.permission.domain.Permission;
import com.bulkup.raptor.role.repository.RolePermissionRepository;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.RequiredArgsConstructor;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LoginService {

    private final MemberRepository memberRepository;
    private final RolePermissionRepository rolePermissions;
    private final PasswordEncoder passwordEncoder;
    private final SecurityContextRepository securityContextRepository =
            new HttpSessionSecurityContextRepository();

    @Transactional(readOnly = true)
    public MemberSessionResponse login(
            LoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        Member member = memberRepository.findByEmail(email).orElse(null);
        if (member == null
                || !passwordEncoder.matches(request.password(), member.getPasswordHash())) {
            throw new BusinessException(ErrorCode.LOGIN_FAILED);
        }
        if (member.getStatus() == MemberStatus.SUSPENDED) {
            throw new BusinessException(ErrorCode.MEMBER_SUSPENDED);
        }
        if (member.getStatus() != MemberStatus.ACTIVE) {
            throw new BusinessException(ErrorCode.EMAIL_VERIFICATION_REQUIRED);
        }
        establishSession(member, httpRequest, httpResponse);
        return sessionResponse(member);
    }

    @Transactional(readOnly = true)
    public MemberSessionResponse currentMember(
            HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || authentication instanceof AnonymousAuthenticationToken
                || !(authentication.getPrincipal() instanceof Long memberId)) {
            throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
        }
        Member member =
                memberRepository
                        .findById(memberId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_REQUIRED));
        if (member.getStatus() != MemberStatus.ACTIVE) {
            throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
        }
        return sessionResponse(member);
    }

    public void logout(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        new SecurityContextLogoutHandler()
                .logout(
                        httpRequest,
                        httpResponse,
                        SecurityContextHolder.getContext().getAuthentication());
    }

    private void establishSession(
            Member member, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        // 재로그인 시 기존 세션 ID를 교체해 세션 고정을 방지한다.
        if (httpRequest.getSession(false) != null) httpRequest.changeSessionId();

        var authorities = new LinkedHashSet<SimpleGrantedAuthority>();
        member.getRoles()
                .forEach(
                        role ->
                                authorities.add(
                                        new SimpleGrantedAuthority("ROLE_" + role.getCode())));
        permissionCodes(member).forEach(code -> authorities.add(new SimpleGrantedAuthority(code)));

        var authentication =
                new UsernamePasswordAuthenticationToken(
                        member.getId(), // principal: 인증 대상인 회원 ID이다.
                        null, // credentials: 비밀번호 같은 인증 수단이다. 검증 후 보관하지 않는다.
                        authorities); // authorities: 회원의 모든 역할과 개별 권한이다.

        // 각 역할의 로그인 당시 상태를 역할 ID별로 모은다.
        Map<Long, RoleState> roleStates =
                member.getRoles().stream()
                        .collect(
                                Collectors.toMap(
                                        role -> role.getId(),
                                        role ->
                                                new RoleState(
                                                        role.getCode(),
                                                        role.getPermissionVersion())));

        // 회원 세션 버전과 역할별 상태를 묶는다.
        MemberSessionDetails sessionDetails =
                new MemberSessionDetails(member.getSessionVersion(), roleStates);

        // 인증 객체의 details 자리에 로그인 당시 상태 정보를 저장한다.
        // sessionDetails 객체를 통째로 담는다. setDetails는 내부 구조를 알 필요가 없다.
        // 이후 필터가 객체 안의 회원 세션 버전과 역할별 상태를 읽어 비교한다.
        authentication.setDetails(sessionDetails);

        // 로그인 정보를 넣을 보관함을 만든다.
        SecurityContext context = SecurityContextHolder.createEmptyContext();

        // 보관함에 방금 만든 로그인 정보를 넣는다.
        context.setAuthentication(authentication);

        // 현재 요청에서 이 로그인 정보를 사용한다.
        SecurityContextHolder.setContext(context);

        // 다음 요청에서도 로그인 상태가 이어지도록 서버 세션에 보관한다.
        // 새 세션을 만들면 Tomcat이 Set-Cookie 응답 헤더로 JSESSIONID를 브라우저에 전달한다.
        // 기존 세션 ID 교체에 따른 쿠키 응답은 위의 changeSessionId()에서 처리한다.
        securityContextRepository.saveContext(context, httpRequest, httpResponse);
    }

    private MemberSessionResponse sessionResponse(Member member) {
        // 1. 회원이 가진 역할 ID를 모은다.
        List<Long> roleIds = member.getRoles().stream()
                .map(role -> role.getId())
                .toList();

        // 2. 역할들에 연결된 권한을 조회한다.
        List<Permission> permissions =
                rolePermissions.findPermissionsForRoles(roleIds);

        // 3. 회원 정보와 권한으로 응답을 만든다.
        return MemberSessionResponse.from(member, permissions);
    }

    private List<String> permissionCodes(Member member) {
        return rolePermissions.findCodesForRoles(
                member.getRoles().stream().map(role -> role.getId()).toList());
    }
}
