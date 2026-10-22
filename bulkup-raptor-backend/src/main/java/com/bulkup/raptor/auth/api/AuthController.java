package com.bulkup.raptor.auth.api;

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
