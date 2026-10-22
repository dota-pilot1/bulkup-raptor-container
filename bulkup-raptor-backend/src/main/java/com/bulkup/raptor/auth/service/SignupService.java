package com.bulkup.raptor.auth.service;

import com.bulkup.raptor.auth.api.SignupRequest;
import com.bulkup.raptor.auth.api.SignupResponse;
import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.role.repository.RoleRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class SignupService {

    private final MemberRepository memberRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailVerificationService emailVerificationService;

    @Transactional
    public SignupResponse signup(SignupRequest request) {
        String email = normalizeEmail(request.email());
        if (!request.password().equals(request.passwordConfirm())) {
            throw new BusinessException(ErrorCode.PASSWORD_CONFIRM_MISMATCH);
        }
        if (!request.password().matches(".*[A-Za-z].*") || !request.password().matches(".*\\d.*")) {
            throw new BusinessException(ErrorCode.WEAK_PASSWORD);
        }
        if (memberRepository.existsByEmail(email)) {
            throw new BusinessException(ErrorCode.MEMBER_EMAIL_DUPLICATED);
        }

        emailVerificationService.consumeForSignup(email, request.emailVerificationToken());

        Member member =
                Member.pending(
                        email,
                        passwordEncoder.encode(request.password()),
                        request.name().trim(),
                        Instant.now(),
                        roleRepository
                                .findByCode("MEMBER")
                                .orElseThrow(
                                        () -> new BusinessException(ErrorCode.ROLE_NOT_FOUND)));
        member.activateAfterEmailVerification();
        try {
            return SignupResponse.from(memberRepository.save(member));
        } catch (DataIntegrityViolationException exception) {
            // 동시 요청에서도 unique(email) 제약을 동일한 도메인 오류로 변환한다.
            throw new BusinessException(ErrorCode.MEMBER_EMAIL_DUPLICATED);
        }
    }

    static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
