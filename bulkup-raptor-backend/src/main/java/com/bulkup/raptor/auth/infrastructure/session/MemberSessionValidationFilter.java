package com.bulkup.raptor.auth.infrastructure.session;

import com.bulkup.raptor.auth.domain.MemberStatus;
import com.bulkup.raptor.auth.repository.MemberRepository;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.RequiredArgsConstructor;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

@RequiredArgsConstructor
public class MemberSessionValidationFilter extends OncePerRequestFilter {
    private final MemberRepository memberRepository;
    private final SecurityContextLogoutHandler logoutHandler = new SecurityContextLogoutHandler();

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        // 로그인 시점의 인증 정보를 가져온다.
        Authentication loginAuthentication =
                SecurityContextHolder.getContext().getAuthentication();

        // 회원 로그인 정보가 없거나 인증 정보가 유효하지 않은 경우,
        // 다음 보안 필터 체인으로 요청을 전달한다.
        if (loginAuthentication == null
                || !(loginAuthentication.getPrincipal() instanceof Long memberId)) {

            chain.doFilter(request, response);
            return;
        }

        // 기존 로그인이 현재 DB 상태와 맞지 않으면 세션과 인증 정보를 정리한다.
        if (!isLoginStillValid(memberId, loginAuthentication)) {
            try {
                logoutHandler.logout(request, response, loginAuthentication);
            } catch (IllegalStateException ignored) {
                // 동시에 다른 요청이 세션을 종료했어도 현재 요청의 인증 정보는 제거한다.
                SecurityContextHolder.clearContext();
            }
        }

        chain.doFilter(request, response);
    }

    // 로그인 세션이 여전히 유효한지 확인한다.
    // 여러 조건에 따라 유효하지 않은 세션을 걸러낸다.
    private boolean isLoginStillValid(long memberId, Authentication loginAuthentication) {

        // 인증 객체에서 details를 읽는다.
        Object authenticationDetails = loginAuthentication.getDetails();

        // 로그인 당시 저장한 회원 세션 정보가 없으면 유효하지 않다.
        if (!(authenticationDetails instanceof MemberSessionDetails)) {
            return false;
        }

        // 로그인할 때 details에 저장한 MemberSessionDetails를 꺼내 사용한다.
        // 위에서 실제 타입도 확인했으므로 해당 타입으로 안전하게 형 변환한다.
        MemberSessionDetails memberSessionDetailsAtLogin =
                (MemberSessionDetails) authenticationDetails;

        // 2. 같은 회원의 현재 DB 상태를 한 번 조회한다.
        var databaseRows = memberRepository.findSessionState(memberId);
        if (databaseRows.isEmpty()) {
            return false;
        }

        var currentMember = databaseRows.getFirst();
        // 회원 상태가 ACTIVE가 아니면 세션이 유효하지 않다.
        if (currentMember.getStatus() != MemberStatus.ACTIVE) {
            return false;
        }

        // 로그인 당시 회원 세션 버전과 현재 DB 버전을 비교한다.
        if (memberSessionDetailsAtLogin.version() != currentMember.getSessionVersion()) {
            return false;
        }

        // 데이터베이스에서 가져온 여러 역할 정보를 맵 형태로 재구성한다.
        Map<Long, RoleState> currentRoles = new LinkedHashMap<>();
        for (var row : databaseRows) {
            if (row.getRoleId() != null) {
                currentRoles.put(
                        row.getRoleId(),
                        new RoleState(row.getRoleCode(), row.getPermissionVersion()));
            }
        }

        // currentRoles는 현재 DB에서 조회한 역할 정보이다.
        // 비교 대상인 memberSessionDetailsAtLogin.roles()는 로그인 당시 저장한 역할 정보이다.
        // Map.equals()로 역할 ID와 RoleState의 코드·권한 버전이 같은지 비교한다.
        // 현재 역할이 없거나 로그인 당시 정보와 다르면 로그인을 무효로 판단한다.
        if (currentRoles.isEmpty() || !memberSessionDetailsAtLogin.roles().equals(currentRoles)) {
            return false;
        }

        return true;
    }

    /*
     * 실행 코드에서 제거한 검사 — 참고용이며 실행하지 않는다.
     *
     * 1. 역할 개수·ID·코드·권한 버전을 직접 비교하던 코드
     * 현재는 roles().equals(currentRoles)로 비교한다.
     * 아래 코드는 같은 비교 목적을 풀어 쓴 예이며 Map.equals()의 실제 내부 구현은 아니다.
     *
     * if (currentRoles.isEmpty()
     *         || memberSessionDetailsAtLogin.roles().size() != currentRoles.size()) {
     *     return false;
     * }
     *
     * for (var roleAtLogin : memberSessionDetailsAtLogin.roles().entrySet()) {
     *     Long roleId = roleAtLogin.getKey();
     *     RoleState loginRole = roleAtLogin.getValue();
     *     RoleState currentRole = currentRoles.get(roleId);
     *
     *     if (currentRole == null) {
     *         return false;
     *     }
     *     if (!java.util.Objects.equals(loginRole.code(), currentRole.code())) {
     *         return false;
     *     }
     *     if (loginRole.permissionVersion() != currentRole.permissionVersion()) {
     *         return false;
     *     }
     * }
     *
     * 2. 인증 객체의 ROLE_ 권한을 다시 확인하던 코드
     * 로그인 시 details의 역할 정보와 authorities를 같은 회원 역할로 함께 생성한다.
     * 이 생성 규칙을 전제로, 필터에서는 DB와 details의 역할 Map 비교만 수행한다.
     * 아래 검사는 DB 역할 코드가 authorities에도 포함되는지 확인하던 방어 검사이다.
     * 역할별 권한 버전 비교는 이 검사가 아니라 위의 Map.equals()에서 수행한다.
     *
     * var loginAuthorities = loginAuthentication.getAuthorities().stream()
     *         .map(authority -> authority.getAuthority())
     *         .collect(java.util.stream.Collectors.toSet());
     * for (RoleState currentRole : currentRoles.values()) {
     *     if (!loginAuthorities.contains("ROLE_" + currentRole.code())) {
     *         return false;
     *     }
     * }
     */
}
