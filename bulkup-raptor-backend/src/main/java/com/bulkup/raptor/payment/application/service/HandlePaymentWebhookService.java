package com.bulkup.raptor.payment.application.service;

import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.payment.infrastructure.PortOneWebhookVerifier;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Service
public class HandlePaymentWebhookService {
    private final PortOneWebhookVerifier signatures;
    private final VerifyPaymentService payments;
    private final String storeId;
    private final JsonMapper json = JsonMapper.builder().build();

    public HandlePaymentWebhookService(PortOneWebhookVerifier signatures, VerifyPaymentService payments,
            @Value("${app.portone.store-id:}") String storeId) {
        this.signatures = signatures;
        this.payments = payments;
        this.storeId = storeId.trim();
    }

    public void processPaymentWebhook(String rawBody, Map<String, List<String>> headers) {
        // 1. 본문을 JSON으로 해석하기 전에 원문과 헤더로 서명·전송 시각을 검사한다.
        signatures.verify(rawBody, headers);

        // 2. 서명 검사를 통과한 본문을 JSON으로 읽고 이벤트 구조를 확인한다.
        JsonNode event;
        try { event = json.readTree(rawBody); }
        catch (Exception error) { throw new BusinessException(ErrorCode.INVALID_INPUT); }
        if (event == null || !event.isObject() || !event.path("type").isTextual())
            throw new BusinessException(ErrorCode.INVALID_INPUT);
        // 이번 단계는 완료 알림만 처리한다. 그 외 이벤트와 추가 필드는 무시한다.
        if (!"Transaction.Paid".equals(event.path("type").asText())) return;
        // 3. 완료 알림의 결제 ID 형식과 상점 ID를 확인한다.
        if (storeId.isBlank()) throw new BusinessException(ErrorCode.PAYMENT_WEBHOOK_NOT_CONFIGURED);
        var data = event.path("data");
        if (!data.path("paymentId").isTextual()
                || !data.path("paymentId").asText().matches("[A-Za-z0-9_-]{1,64}")
                || !data.path("storeId").isTextual())
            throw new BusinessException(ErrorCode.INVALID_INPUT);
        if (!storeId.equals(data.path("storeId").asText()))
            throw new BusinessException(ErrorCode.PAYMENT_VERIFICATION_MISMATCH);
        // 4. DB에 등록된 결제는 포트원에서 다시 조회해 검증한다.
        // DB에 없는 결제는 무시하며, 검증을 통과한 결제와 주문만 PAID로 반영한다.
        payments.verifyWebhook(data.path("paymentId").asText());
    }
}
