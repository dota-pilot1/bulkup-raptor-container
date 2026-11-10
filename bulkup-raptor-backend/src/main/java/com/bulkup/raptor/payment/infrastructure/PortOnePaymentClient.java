package com.bulkup.raptor.payment.infrastructure;

import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Component
public class PortOnePaymentClient {
    public record RemotePayment(String id, String storeId, String channelKey, String status,
            long totalAmount, String currency, Instant paidAt, String transactionId,
            String pgTxId, String method, long cancelledAmount) {}

    private final String baseUrl;
    private final String secret;
    private final String storeId;
    private final String channelKey;
    // 인증 헤더가 다른 주소로 전달되지 않도록 리다이렉트를 따르지 않는다.
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NEVER).build();
    private final JsonMapper json = JsonMapper.builder().build();

    public PortOnePaymentClient(@Value("${app.portone.base-url:https://api.portone.io}") String baseUrl,
            @Value("${app.portone.api-secret:}") String secret,
            @Value("${app.portone.store-id:}") String storeId,
            @Value("${app.portone.channel-key:}") String channelKey) {
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.secret = secret.trim();
        this.storeId = storeId.trim();
        this.channelKey = channelKey.trim();
    }

    public RemotePayment find(String paymentId) {
        if (secret.isBlank() || storeId.isBlank() || channelKey.isBlank())
            throw new BusinessException(ErrorCode.PAYMENT_PROVIDER_NOT_CONFIGURED);
        try {
            // API 시크릿은 서버의 조회 요청에만 넣는다.
            var request = HttpRequest.newBuilder(URI.create(baseUrl + "/payments/"
                    + URLEncoder.encode(paymentId, StandardCharsets.UTF_8) + "?storeId="
                    + URLEncoder.encode(storeId, StandardCharsets.UTF_8)))
                    .timeout(Duration.ofSeconds(20)).header("Authorization", "PortOne " + secret).GET().build();
            var response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 404) {
                // 포트원이 결제 내역 없음으로 응답한 경우만 미등록 결제로 처리한다.
                if (java.util.Set.of("PAYMENT_NOT_FOUND", "PaymentNotFoundError")
                        .contains(json.readTree(response.body()).path("type").asText())) return null;
                throw new BusinessException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE);
            }
            if (response.statusCode() != 200) throw new BusinessException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE);
            JsonNode node = json.readTree(response.body());
            // 금액이 정수가 아니거나 long 범위를 벗어나면 응답을 거부한다.
            var total = node.path("amount").path("total");
            if (!total.isIntegralNumber() || !total.canConvertToLong())
                throw new BusinessException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE);
            var cancelled = node.path("amount").path("cancelled");
            if (!cancelled.isMissingNode() && (!cancelled.isIntegralNumber() || !cancelled.canConvertToLong()))
                throw new BusinessException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE);
            var paidAt = node.path("paidAt").asText("");
            var method = node.path("method");
            // 채널 식별에는 channel.id가 아닌 channel.key를 사용한다.
            return new RemotePayment(node.path("id").asText(), node.path("storeId").asText(),
                    node.path("channel").path("key").asText(), node.path("status").asText(),
                    total.asLong(), node.path("currency").asText(), paidAt.isBlank() ? null : Instant.parse(paidAt),
                    node.path("transactionId").asText(""), node.path("pgTxId").asText(""),
                    method.path("provider").asText(method.path("type").asText("")), cancelled.asLong(0));
        } catch (BusinessException error) { throw error; }
        catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new BusinessException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE);
        } catch (Exception error) {
            // 외부 응답 본문과 인증 헤더는 오류 메시지로 노출하지 않는다.
            throw new BusinessException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE);
        }
    }

    public void cancel(String paymentId, long amount) {
        if (secret.isBlank() || storeId.isBlank() || channelKey.isBlank())
            throw new BusinessException(ErrorCode.PAYMENT_PROVIDER_NOT_CONFIGURED);
        try {
            // Fixed amount and balance guard also prevent duplicate refunds after key expiry.
            var body = json.writeValueAsString(java.util.Map.of("storeId", storeId, "amount", amount,
                    "currentCancellableAmount", amount, "reason", "구매자 배송 준비 중 주문 취소", "requester", "CUSTOMER"));
            var request = HttpRequest.newBuilder(URI.create(baseUrl + "/payments/"
                    + URLEncoder.encode(paymentId, StandardCharsets.UTF_8) + "/cancel"))
                    .timeout(Duration.ofSeconds(20)).header("Authorization", "PortOne " + secret)
                    .header("Content-Type", "application/json")
                    .header("Idempotency-Key", "\"order-cancel-" + paymentId + "\"")
                    .POST(HttpRequest.BodyPublishers.ofString(body)).build();
            var response = http.send(request, HttpResponse.BodyHandlers.discarding());
            if (response.statusCode() != 200) throw new BusinessException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE);
        } catch (BusinessException error) { throw error; }
        catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new BusinessException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE);
        } catch (Exception error) { throw new BusinessException(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE); }
    }

    // 현재 상점과 카카오페이 채널에서 발생한 결제인지 확인한다.
    public boolean matchesConfiguration(RemotePayment payment) {
        return storeId.equals(payment.storeId()) && channelKey.equals(payment.channelKey());
    }
}
