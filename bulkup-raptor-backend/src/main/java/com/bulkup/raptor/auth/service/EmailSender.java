package com.bulkup.raptor.auth.service;

public interface EmailSender {
    void sendVerificationCode(String email, String code);
}
