package com.bulkup.raptor.payment.api;

import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.payment.application.service.HandlePaymentWebhookService;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;


@RestController
@RequiredArgsConstructor
public class PaymentWebhookController {
    private final HandlePaymentWebhookService paymentWebhookService;

    // 로그인 세션 대신 웹훅 서명으로 검증하며, 정상 처리 시 빈 200 응답을 보낸다.
    @PostMapping(value = "/api/payments/webhooks/portone", consumes = MediaType.APPLICATION_JSON_VALUE)
    public void receivePortOneWebhook(@RequestBody byte[] body, @RequestHeader HttpHeaders headers) {
        // 1. 요청 본문이 64 KiB를 넘으면 서비스 호출 전에 거절한다.
        if (body.length > 65_536) throw new BusinessException(ErrorCode.INVALID_INPUT);

        // 2. JSON으로 변환하지 않고, 서명 검사에 사용할 본문 원문을 문자열로 읽는다.
        String rawBody = new String(body, StandardCharsets.UTF_8);

        // 3. 요청 헤더를 복사한다. 실제 서명 검사는 서비스에서 수행한다.
        Map<String, List<String>> webhookHeaders = new HashMap<>();
        headers.forEach(webhookHeaders::put);

        // 4. 서비스에 서명 검사와 이벤트 처리를 맡긴다.
        // 처리 대상 결제는 포트원에서 조회·검증한 뒤 결제와 주문에 반영한다.
        paymentWebhookService.processPaymentWebhook(rawBody, webhookHeaders);
    }
}
