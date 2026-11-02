package com.bulkup.raptor.auth.api;

import com.bulkup.raptor.auth.application.service.UpdateProfileImageService;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import com.bulkup.raptor.auth.service.EmailVerificationService;
import com.bulkup.raptor.auth.service.LoginService;
import com.bulkup.raptor.auth.service.SignupService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final SignupService signupService;
    private final EmailVerificationService emailVerificationService;
    private final LoginService loginService;
    private final UpdateProfileImageService profileImages;

    @io.swagger.v3.oas.annotations.Operation(summary = "내 프로필 이미지 변경",
            description = "POST /api/images로 업로드한 본인 소유의 key를 회원 정보에 연결한다.")
    @PatchMapping("/me/profile-image")
    public ProfileImageResponse updateProfileImage(
            @AuthenticationPrincipal Long memberId,
            @Valid @RequestBody UpdateProfileImageRequest request) {
        return profileImages.update(memberId, request.key());
    }

    @PostMapping("/email-verifications")
    public ResponseEntity<Void> requestEmailVerification(@Valid @RequestBody EmailVerificationRequest request) {
        emailVerificationService.request(request.email());
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/email-verifications/confirm")
    public ResponseEntity<EmailVerificationConfirmResponse> confirmEmailVerification(
        @Valid @RequestBody EmailVerificationConfirmRequest request
    ) {
        return ResponseEntity.ok(emailVerificationService.confirm(request));
    }

    @PostMapping("/signup")
    public ResponseEntity<SignupResponse> signup(@Valid @RequestBody SignupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(signupService.signup(request));
    }

    @PostMapping("/login")
    public MemberSessionResponse login(
        @Valid @RequestBody LoginRequest request,
        HttpServletRequest httpRequest,
        HttpServletResponse httpResponse
    ) {
        return loginService.login(request, httpRequest, httpResponse);
    }

    @GetMapping("/me")
    public MemberSessionResponse me(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        return loginService.currentMember(httpRequest, httpResponse);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        loginService.logout(httpRequest, httpResponse);
        return ResponseEntity.noContent().build();
    }
}
