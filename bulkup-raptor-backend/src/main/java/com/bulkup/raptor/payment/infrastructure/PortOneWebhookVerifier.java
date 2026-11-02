package com.bulkup.raptor.payment.infrastructure;

import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.standardwebhooks.Webhook;
import com.standardwebhooks.exceptions.WebhookVerificationException;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class PortOneWebhookVerifier {
    private final Webhook webhook;

    public PortOneWebhookVerifier(@Value("${app.portone.webhook-secret:}") String secret) {
        Webhook configured = null;
        try {
            if (!secret.isBlank()) configured = new Webhook(secret.trim());
        } catch (Exception ignored) {
            // 잘못된 시크릿도 요청 시 503으로 처리하며 실제 값은 노출하지 않는다.
        }
        this.webhook = configured;
    }

    public void verify(String rawBody, Map<String, List<String>> headers) {
        if (webhook == null) throw new BusinessException(ErrorCode.PAYMENT_WEBHOOK_NOT_CONFIGURED);
        try {
            // JSON 재직렬화 없이 원문과 헤더의 서명·전송 시각을 검사한다.
            webhook.verify(rawBody, headers);
        } catch (WebhookVerificationException error) {
            throw new BusinessException(ErrorCode.PAYMENT_WEBHOOK_SIGNATURE_INVALID);
        }
    }
}
