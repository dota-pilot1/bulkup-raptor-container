package com.bulkup.raptor.auth.infrastructure.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.bulkup.raptor.auth.domain.MemberStatus;
import com.bulkup.raptor.auth.infrastructure.session.RoleState;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.auth.repository.MemberRepository.SessionState;

import jakarta.servlet.FilterChain;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

class MemberSessionValidationFilterTest {
    private final MemberRepository memberRepository = mock(MemberRepository.class);
    private final MemberSessionValidationFilter filter =
            new MemberSessionValidationFilter(memberRepository);
    private final FilterChain chain = mock(FilterChain.class);
    private final MockHttpServletRequest request = new MockHttpServletRequest();
    private final MockHttpServletResponse response = new MockHttpServletResponse();
    private final MockHttpSession session = new MockHttpSession();

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void unchangedRolesKeepLoginRegardlessOfDatabaseRowOrder() throws Exception {
        var login = login("ROLE_ADMIN", "ROLE_OPERATOR", "PRODUCT_MANAGE");
        when(memberRepository.findSessionState(10L))
                .thenReturn(List.of(row(2L, "OPERATOR", 7), row(1L, "ADMIN", 3)));

        run(login);

        assertThat(session.isInvalid()).isFalse();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isSameAs(login);
        verify(memberRepository).findSessionState(10L);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("changedStates")
    void changedMemberOrAnyAssignedRoleEndsLogin(String reason, List<SessionState> rows)
            throws Exception {
        when(memberRepository.findSessionState(10L)).thenReturn(rows);

        run(login("ROLE_ADMIN", "ROLE_OPERATOR"));

        assertThat(session.isInvalid()).as(reason).isTrue();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    static Stream<Arguments> changedStates() {
        return Stream.of(
                Arguments.of("member deleted", List.of()),
                Arguments.of("member suspended", List.of(
                        new Row(5, MemberStatus.SUSPENDED, 1L, "ADMIN", 3L))),
                Arguments.of("member pending", List.of(
                        new Row(5, MemberStatus.PENDING, 1L, "ADMIN", 3L))),
                Arguments.of("member session version changed", List.of(
                        new Row(6, MemberStatus.ACTIVE, 1L, "ADMIN", 3L),
                        new Row(6, MemberStatus.ACTIVE, 2L, "OPERATOR", 7L))),
                Arguments.of("second role permission version changed", List.of(
                        row(1L, "ADMIN", 3), row(2L, "OPERATOR", 8))),
                Arguments.of("first role permission version changed", List.of(
                        row(1L, "ADMIN", 4), row(2L, "OPERATOR", 7))),
                Arguments.of("role removed", List.of(row(1L, "ADMIN", 3))),
                Arguments.of("role added", List.of(
                        row(1L, "ADMIN", 3), row(2L, "OPERATOR", 7), row(3L, "EDITOR", 1))),
                Arguments.of("role replaced with equal number of roles", List.of(
                        row(1L, "ADMIN", 3), row(3L, "EDITOR", 7))),
                Arguments.of("role code changed", List.of(
                        row(1L, "ADMIN", 3), row(2L, "EDITOR", 7))),
                Arguments.of("member has no roles", List.of(
                        new Row(5, MemberStatus.ACTIVE, null, null, null))));
    }

    @Test
    void matchingSessionStateKeepsLoginWithoutRecheckingRoleAuthorities() throws Exception {
        when(memberRepository.findSessionState(10L))
                .thenReturn(List.of(row(1L, "ADMIN", 3), row(2L, "OPERATOR", 7)));
        var login = login("ROLE_ADMIN");

        run(login);

        assertThat(session.isInvalid()).isFalse();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isSameAs(login);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = "unexpected details type")
    void missingOrUnrecognizedLoginStateEndsLogin(Object details) throws Exception {
        var login = login("ROLE_ADMIN", "ROLE_OPERATOR");
        login.setDetails(details);

        run(login);

        assertThat(session.isInvalid()).isTrue();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verifyNoInteractions(memberRepository);
    }

    @Test
    void missingAuthenticationContinuesWithoutDatabaseLookupOrLogout() throws Exception {
        run(null);

        assertThat(session.isInvalid()).isFalse();
        verifyNoInteractions(memberRepository);
    }

    @Test
    void anonymousAuthenticationContinuesWithoutDatabaseLookupOrLogout() throws Exception {
        var anonymous = new AnonymousAuthenticationToken(
                "key", "anonymousUser", List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")));

        run(anonymous);

        assertThat(session.isInvalid()).isFalse();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isSameAs(anonymous);
        verifyNoInteractions(memberRepository);
    }

    @Test
    void invalidAuthenticationDoesNotCreateAnHttpSession() throws Exception {
        var login = login("ROLE_ADMIN", "ROLE_OPERATOR");
        login.setDetails(null);
        SecurityContextHolder.getContext().setAuthentication(login);

        filter.doFilter(request, response, chain);

        assertThat(request.getSession(false)).isNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request, response);
    }

    @Test
    void concurrentSessionInvalidationStillClearsAuthenticationAndContinues() throws Exception {
        var login = login("ROLE_ADMIN", "ROLE_OPERATOR");
        login.setDetails(null);
        var concurrentlyClosedSession = mock(jakarta.servlet.http.HttpSession.class);
        var concurrentRequest = mock(jakarta.servlet.http.HttpServletRequest.class);
        when(concurrentRequest.getSession(false)).thenReturn(concurrentlyClosedSession);
        doThrow(new IllegalStateException("already invalidated"))
                .when(concurrentlyClosedSession).invalidate();
        SecurityContextHolder.getContext().setAuthentication(login);

        filter.doFilter(concurrentRequest, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(concurrentRequest, response);
        verifyNoInteractions(memberRepository);
    }

    private void run(Authentication authentication) throws Exception {
        request.setSession(session);
        SecurityContextHolder.getContext().setAuthentication(authentication);
        filter.doFilter(request, response, chain);
        verify(chain).doFilter(request, response);
    }

    private UsernamePasswordAuthenticationToken login(String... authorities) {
        var authentication = new UsernamePasswordAuthenticationToken(
                10L, null, Stream.of(authorities).map(SimpleGrantedAuthority::new).toList());
        authentication.setDetails(new MemberSessionDetails(
                5, Map.of(1L, new RoleState("ADMIN", 3), 2L, new RoleState("OPERATOR", 7))));
        return authentication;
    }

    private static SessionState row(Long roleId, String code, long permissionVersion) {
        return new Row(5, MemberStatus.ACTIVE, roleId, code, permissionVersion);
    }

    private record Row(
            long sessionVersion, MemberStatus status, Long roleId,
            String roleCode, Long permissionVersion) implements SessionState {
        public long getSessionVersion() { return sessionVersion; }
        public MemberStatus getStatus() { return status; }
        public Long getRoleId() { return roleId; }
        public String getRoleCode() { return roleCode; }
        public Long getPermissionVersion() { return permissionVersion; }
    }
}
