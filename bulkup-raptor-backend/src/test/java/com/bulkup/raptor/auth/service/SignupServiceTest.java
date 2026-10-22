package com.bulkup.raptor.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doNothing;

import com.bulkup.raptor.auth.api.SignupRequest;
import com.bulkup.raptor.auth.api.SignupResponse;
import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.role.domain.Role;
import com.bulkup.raptor.role.repository.RoleRepository;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@ExtendWith(MockitoExtension.class)
class SignupServiceTest {

    @Mock private RoleRepository roleRepository;

    @Mock
    private MemberRepository memberRepository;

    @Mock
    private EmailVerificationService emailVerificationService;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Test
    void 이메일을_소문자로_정규화하고_PENDING_회원으로_가입한다() {
        SignupService service = new SignupService(memberRepository, roleRepository, passwordEncoder, emailVerificationService);
        SignupRequest request = new SignupRequest(" USER@Example.COM ", "Password1", "Password1", "홍길동", true, true, "verified-token");
        Member saved = Member.pending("user@example.com", passwordEncoder.encode("Password1"), "홍길동", Instant.now(), Role.create("MEMBER","일반 회원",""));
        when(memberRepository.existsByEmail("user@example.com")).thenReturn(false);
        when(roleRepository.findByCode("MEMBER")).thenReturn(java.util.Optional.of(Role.create("MEMBER","일반 회원","")));
        when(memberRepository.save(any(Member.class))).thenReturn(saved);
        doNothing().when(emailVerificationService).consumeForSignup("user@example.com", "verified-token");

        SignupResponse response = service.signup(request);

        assertThat(response.email()).isEqualTo("user@example.com");
        assertThat(response.status().name()).isEqualTo("PENDING");
        verify(memberRepository).save(any(Member.class));
    }

    @Test
    void 중복_이메일이면_회원가입을_거부한다() {
        SignupService service = new SignupService(memberRepository, roleRepository, passwordEncoder, emailVerificationService);
        when(memberRepository.existsByEmail("user@example.com")).thenReturn(true);

        assertThatThrownBy(() -> service.signup(new SignupRequest("user@example.com", "Password1", "Password1", "홍길동", true, true, "verified-token")))
            .isInstanceOf(BusinessException.class)
            .extracting("errorCode")
            .isEqualTo(ErrorCode.MEMBER_EMAIL_DUPLICATED);
        verify(memberRepository, never()).save(any(Member.class));
    }

    @Test
    void 비밀번호_확인이_다르면_회원가입을_거부한다() {
        SignupService service = new SignupService(memberRepository, roleRepository, passwordEncoder, emailVerificationService);

        assertThatThrownBy(() -> service.signup(new SignupRequest("user@example.com", "Password1", "Password2", "홍길동", true, true, "verified-token")))
            .isInstanceOf(BusinessException.class)
            .extracting("errorCode")
            .isEqualTo(ErrorCode.PASSWORD_CONFIRM_MISMATCH);
        verify(memberRepository, never()).save(any(Member.class));
    }
}
