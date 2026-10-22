package com.bulkup.raptor.auth.domain;

import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;

@Entity
@Table(name = "email_verifications")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EmailVerification {

    private static final int MAX_ATTEMPTS = 5;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 254)
    private String email;

    @Column(name = "code_hash", nullable = false, length = 100)
    private String codeHash;

    @Column(name = "verification_token_hash", nullable = false, length = 100)
    private String verificationTokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount;

    @Column(name = "verified_at")
    private Instant verifiedAt;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    private EmailVerification(String email, String codeHash, String verificationTokenHash, Instant expiresAt) {
        this.email = email;
        this.codeHash = codeHash;
        this.verificationTokenHash = verificationTokenHash;
        this.expiresAt = expiresAt;
        this.attemptCount = 0;
    }

    public static EmailVerification issue(String email, String codeHash, String verificationTokenHash, Instant expiresAt) {
        return new EmailVerification(email, codeHash, verificationTokenHash, expiresAt);
    }

    public void confirmCode(String code, PasswordEncoder passwordEncoder, Instant now) {
        if (isExpired(now)) {
            throw new BusinessException(ErrorCode.EMAIL_VERIFICATION_EXPIRED);
        }
        if (isConsumed()) {
            throw new BusinessException(ErrorCode.EMAIL_VERIFICATION_ALREADY_USED);
        }
        if (isVerified()) {
            throw new BusinessException(ErrorCode.EMAIL_VERIFICATION_ALREADY_CONFIRMED);
        }
        if (attemptCount >= MAX_ATTEMPTS) {
            throw new BusinessException(ErrorCode.EMAIL_VERIFICATION_ATTEMPTS_EXCEEDED);
        }
        attemptCount++;
        if (!passwordEncoder.matches(code, codeHash)) {
            throw new BusinessException(ErrorCode.EMAIL_VERIFICATION_CODE_INVALID);
        }
        verifiedAt = now;
    }

    public void consumeToken(String token, PasswordEncoder passwordEncoder, Instant now) {
        if (isConsumed()) {
            throw new BusinessException(ErrorCode.EMAIL_VERIFICATION_ALREADY_USED);
        }
        if (isExpired(now)) {
            throw new BusinessException(ErrorCode.EMAIL_VERIFICATION_EXPIRED);
        }
        if (!isVerified() || !passwordEncoder.matches(token, verificationTokenHash)) {
            throw new BusinessException(ErrorCode.EMAIL_VERIFICATION_REQUIRED);
        }
        consumedAt = now;
    }

    public void replaceVerificationToken(String verificationTokenHash) {
        this.verificationTokenHash = verificationTokenHash;
    }

    public boolean isExpired(Instant now) {
        return !now.isBefore(expiresAt);
    }

    public boolean isVerified() {
        return verifiedAt != null;
    }

    public boolean isConsumed() {
        return consumedAt != null;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
