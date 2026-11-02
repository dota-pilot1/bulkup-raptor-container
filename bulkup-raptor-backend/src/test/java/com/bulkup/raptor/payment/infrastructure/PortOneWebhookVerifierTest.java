package com.bulkup.raptor.payment.infrastructure;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;

class PortOneWebhookVerifierTest {
    static final byte[] key = "unit-test-secret-only".getBytes(StandardCharsets.UTF_8);
    final String secret = "whsec_" + Base64.getEncoder().encodeToString(key);

    @Test void emptyOrMalformedSecretFailsClosed() {
        for (String value : List.of("", "whsec_", "not-base64!"))
            assertError(ErrorCode.PAYMENT_WEBHOOK_NOT_CONFIGURED, () -> new PortOneWebhookVerifier(value).verify("{}", Map.of()));
    }

    @Test void missingHeadersCannotPassVerification() {
        assertError(ErrorCode.PAYMENT_WEBHOOK_SIGNATURE_INVALID, () -> new PortOneWebhookVerifier(secret).verify("{}", Map.of()));
    }

    @Test void acceptsUpperCaseHeadersAndRotatedSignatureList() throws Exception {
        String body = "{ \"설명\": \"원문 유지\" }";
        long timestamp = Instant.now().getEpochSecond();
        var mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        String signature = "v1," + Base64.getEncoder().encodeToString(mac.doFinal(("id." + timestamp + "." + body).getBytes(StandardCharsets.UTF_8)));
        new PortOneWebhookVerifier(secret).verify(body, Map.of("WEBHOOK-ID", List.of("id"),
                "WEBHOOK-TIMESTAMP", List.of(Long.toString(timestamp)), "WEBHOOK-SIGNATURE", List.of("v1,invalid " + signature)));
    }

    void assertError(ErrorCode code, Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(BusinessException.class,
                error -> org.assertj.core.api.Assertions.assertThat(error.getErrorCode()).isEqualTo(code));
    }
}
