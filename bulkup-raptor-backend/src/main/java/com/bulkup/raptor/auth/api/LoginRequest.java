package com.bulkup.raptor.auth.api;

import io.swagger.v3.oas.annotations.media.Schema;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
    @Schema(description = "로컬 로그인 확인을 마친 개발용 계정 이메일", example = "terecal2@daum.net")
    @NotBlank(message = "이메일을 입력해 주세요.")
    @Email(message = "올바른 이메일을 입력해 주세요.")
    @Size(max = 254, message = "이메일은 254자 이하로 입력해 주세요.")
    String email,

    @Schema(description = "로컬 개발용 계정 비밀번호", example = "password123", format = "password")
    @NotBlank(message = "비밀번호를 입력해 주세요.")
    @Size(max = 72, message = "비밀번호는 72자 이하로 입력해 주세요.")
    String password
) {}
