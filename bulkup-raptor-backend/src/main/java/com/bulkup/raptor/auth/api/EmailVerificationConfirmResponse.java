package com.bulkup.raptor.auth.api;

public record EmailVerificationConfirmResponse(
    String email,
    String verificationToken,
    boolean verified
) {}
