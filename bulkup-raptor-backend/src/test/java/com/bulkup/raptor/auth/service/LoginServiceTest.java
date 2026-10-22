package com.bulkup.raptor.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bulkup.raptor.auth.api.LoginRequest;
import com.bulkup.raptor.auth.api.MemberSessionResponse;
import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.role.domain.Role;
import com.bulkup.raptor.role.repository.RolePermissionRepository;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.time.Instant;
import java.util.Optional;
import java.util.List;
import com.bulkup.raptor.permission.domain.Permission;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class LoginServiceTest {

    @Mock private MemberRepository memberRepository;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void 이메일과_비밀번호가_맞으면_세션_회원을_반환한다() {
        LoginService service =
                new LoginService(
                        memberRepository, mock(RolePermissionRepository.class), passwordEncoder);
        Member member =
                Member.pending(
                        "user@example.com",
                        passwordEncoder.encode("Password1"),
                        "홍길동",
                        Instant.parse("2026-10-11T00:00:00Z"),
                        Role.create("MEMBER", "일반 회원", ""));
        org.springframework.test.util.ReflectionTestUtils.setField(
                member.getRoles().iterator().next(), "id", 1L);
        member.activateAfterEmailVerification();
        when(memberRepository.findByEmail("user@example.com")).thenReturn(Optional.of(member));
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        when(request.getSession(true)).thenReturn(mock(HttpSession.class));
        when(request.getSession(false)).thenReturn(null);

        MemberSessionResponse session =
                service.login(
                        new LoginRequest(" USER@Example.COM ", "Password1"), request, response);

        assertThat(session.email()).isEqualTo("user@example.com");
        assertThat(session.name()).isEqualTo("홍길동");
        assertThat(session.status().name()).isEqualTo("ACTIVE");
    }

    @Test
    void 내_정보에는_모든_역할의_권한_코드와_표시_정보가_함께_포함된다() {
        var permissions = mock(RolePermissionRepository.class);
        var service = new LoginService(memberRepository, permissions, passwordEncoder);
        var role = Role.create("OPERATOR", "운영자", "");
        var extraRole = Role.create("EDITOR", "편집자", "");
        ReflectionTestUtils.setField(role, "id", 1L);
        ReflectionTestUtils.setField(extraRole, "id", 2L);
        var member = Member.pending("user@example.com", "hash", "홍길동", Instant.now(), role);
        member.changeRoles(java.util.Set.of(role, extraRole));
        member.activateAfterEmailVerification();
        ReflectionTestUtils.setField(member, "id", 10L);
        var category = com.bulkup.raptor.permission.domain.PermissionCategory.create(
                "CUSTOM", "사용자 정의", "", 7);
        var product = Permission.create("PRODUCT_MANAGE", "상품 관리", "상품을 등록하고 수정합니다.", category);
        var custom = Permission.create("CUSTOM_REVIEW", "검수", "사용자 정의 권한", category);
        when(memberRepository.findById(10L)).thenReturn(Optional.of(member));
        when(permissions.findPermissionsForRoles(org.mockito.ArgumentMatchers.argThat(
                ids -> ids.size() == 2 && ids.containsAll(List.of(1L, 2L)))))
                .thenReturn(List.of(custom, product));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(10L, null, List.of()));

        var session = service.currentMember(mock(HttpServletRequest.class), mock(HttpServletResponse.class));

        assertThat(session.roles()).extracting("code").containsExactlyInAnyOrder("OPERATOR", "EDITOR");
        assertThat(session.permissions()).containsExactly("CUSTOM_REVIEW", "PRODUCT_MANAGE");
        assertThat(session.permissionDetails()).extracting("name").containsExactly("검수", "상품 관리");
        assertThat(session.permissionDetails().get(0).description()).isEqualTo("사용자 정의 권한");
        assertThat(session.permissionDetails().get(0).categoryCode()).isEqualTo("CUSTOM");
        assertThat(session.permissionDetails().get(0).categoryName()).isEqualTo("사용자 정의");
        assertThat(session.permissionDetails().get(0).categorySortOrder()).isEqualTo(7);
    }

    @Test
    void 비밀번호가_다르면_로그인을_거부한다() {
        LoginService service =
                new LoginService(
                        memberRepository, mock(RolePermissionRepository.class), passwordEncoder);
        Member member =
                Member.pending(
                        "user@example.com",
                        passwordEncoder.encode("Password1"),
                        "홍길동",
                        Instant.parse("2026-10-11T00:00:00Z"),
                        Role.create("MEMBER", "일반 회원", ""));
        org.springframework.test.util.ReflectionTestUtils.setField(
                member.getRoles().iterator().next(), "id", 1L);
        member.activateAfterEmailVerification();
        when(memberRepository.findByEmail("user@example.com")).thenReturn(Optional.of(member));

        assertThatThrownBy(
                        () ->
                                service.login(
                                        new LoginRequest("user@example.com", "Wrong123"),
                                        mock(HttpServletRequest.class),
                                        mock(HttpServletResponse.class)))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.LOGIN_FAILED);
    }

    @Test
    void 없는_이메일도_같은_오류로_거부한다() {
        LoginService service =
                new LoginService(
                        memberRepository, mock(RolePermissionRepository.class), passwordEncoder);
        when(memberRepository.findByEmail("missing@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(
                        () ->
                                service.login(
                                        new LoginRequest("missing@example.com", "Password1"),
                                        mock(HttpServletRequest.class),
                                        mock(HttpServletResponse.class)))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.LOGIN_FAILED);
    }
}
