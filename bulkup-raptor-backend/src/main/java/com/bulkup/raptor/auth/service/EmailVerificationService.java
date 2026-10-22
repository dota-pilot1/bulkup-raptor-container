package com.bulkup.raptor.auth.service;

import com.bulkup.raptor.auth.api.EmailVerificationConfirmRequest;
import com.bulkup.raptor.auth.api.EmailVerificationConfirmResponse;
import com.bulkup.raptor.auth.domain.EmailVerification;
import com.bulkup.raptor.auth.repository.EmailVerificationRepository;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EmailVerificationService {

    private static final Duration CODE_TTL = Duration.ofMinutes(5);
    private static final Duration RESEND_INTERVAL = Duration.ofSeconds(60);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final EmailVerificationRepository verificationRepository;
    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailSender emailSender;

    @Transactional
    public void request(String rawEmail) {
        String email = normalizeEmail(rawEmail);
        if (memberRepository.existsByEmail(email)) {
            throw new BusinessException(ErrorCode.MEMBER_EMAIL_DUPLICATED);
        }

        verificationRepository.findTopByEmailOrderByCreatedAtDesc(email)
            .filter(previous -> previous.getCreatedAt().plus(RESEND_INTERVAL).isAfter(Instant.now()))
            .ifPresent(previous -> { throw new BusinessException(ErrorCode.EMAIL_VERIFICATION_RATE_LIMITED); });

        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        String token = UUID.randomUUID().toString();
        EmailVerification verification = EmailVerification.issue(
            email,
            passwordEncoder.encode(code),
            passwordEncoder.encode(token),
            Instant.now().plus(CODE_TTL)
        );
        verificationRepository.save(verification);
        emailSender.sendVerificationCode(email, code);
    }

    @Transactional
    public EmailVerificationConfirmResponse confirm(EmailVerificationConfirmRequest request) {
        String email = normalizeEmail(request.email());
        EmailVerification verification = verificationRepository.findTopByEmailOrderByCreatedAtDesc(email)
            .orElseThrow(() -> new BusinessException(ErrorCode.EMAIL_VERIFICATION_NOT_FOUND));
        verification.confirmCode(request.code(), passwordEncoder, Instant.now());
        String token = UUID.randomUUID().toString();
        // 인증 완료 후 발급하는 토큰은 가입 요청 한 번에만 사용한다.
        verification.replaceVerificationToken(passwordEncoder.encode(token));
        return new EmailVerificationConfirmResponse(email, token, true);
    }

    @Transactional
    public void consumeForSignup(String rawEmail, String token) {
        if (token == null || token.isBlank()) {
            throw new BusinessException(ErrorCode.EMAIL_VERIFICATION_REQUIRED);
        }
        String email = normalizeEmail(rawEmail);
        EmailVerification verification = verificationRepository.findTopByEmailOrderByCreatedAtDesc(email)
            .orElseThrow(() -> new BusinessException(ErrorCode.EMAIL_VERIFICATION_REQUIRED));
        verification.consumeToken(token, passwordEncoder, Instant.now());
    }

    static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
