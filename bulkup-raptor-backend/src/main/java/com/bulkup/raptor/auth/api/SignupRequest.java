package com.bulkup.raptor.auth.api;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SignupRequest(
    @NotBlank(message = "이메일은 필수입니다.")
    @Email(message = "올바른 이메일 형식이 아닙니다.")
    @Size(max = 254, message = "이메일은 254자 이하로 입력해 주세요.")
    String email,

    @NotBlank(message = "비밀번호는 필수입니다.")
    @Size(min = 8, max = 72, message = "비밀번호는 8자 이상 72자 이하로 입력해 주세요.")
    String password,

    @NotBlank(message = "비밀번호 확인은 필수입니다.")
    String passwordConfirm,

    @NotBlank(message = "이름은 필수입니다.")
    @Size(max = 50, message = "이름은 50자 이하로 입력해 주세요.")
    String name,

    @AssertTrue(message = "이용약관에 동의해 주세요.")
    boolean termsAgreed,

    @AssertTrue(message = "개인정보 처리방침에 동의해 주세요.")
    boolean privacyAgreed,

    @NotBlank(message = "이메일 인증을 완료해 주세요.")
    String emailVerificationToken
) {}
