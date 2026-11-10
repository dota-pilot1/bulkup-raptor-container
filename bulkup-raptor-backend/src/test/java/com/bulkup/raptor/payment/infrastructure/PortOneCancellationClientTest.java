package com.bulkup.raptor.payment.infrastructure;

import static org.assertj.core.api.Assertions.*;
import com.bulkup.raptor.common.error.*;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class PortOneCancellationClientTest {
    @Test void sendsFullAmountBalanceGuardAndStableQuotedIdempotencyKey() throws Exception {
        var body=new AtomicReference<String>(); var key=new AtomicReference<String>(); var auth=new AtomicReference<String>();
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/payments/payment-test/cancel", exchange -> {
            body.set(new String(exchange.getRequestBody().readAllBytes(),java.nio.charset.StandardCharsets.UTF_8));
            key.set(exchange.getRequestHeaders().getFirst("Idempotency-Key"));
            auth.set(exchange.getRequestHeaders().getFirst("Authorization"));
            if (!"POST".equals(exchange.getRequestMethod())) throw new AssertionError("POST expected");
            exchange.sendResponseHeaders(200,-1);exchange.close();
        });
        server.start();
        try {
            var client=new PortOnePaymentClient("http://127.0.0.1:"+server.getAddress().getPort(),"test-secret","store-test","channel-test");
            client.cancel("payment-test",5000);
            var json=JsonMapper.builder().build().readTree(body.get());
            assertThat(json.path("storeId").asText()).isEqualTo("store-test");
            assertThat(json.path("amount").asLong()).isEqualTo(5000);
            assertThat(json.path("currentCancellableAmount").asLong()).isEqualTo(5000);
            assertThat(json.path("requester").asText()).isEqualTo("CUSTOMER");
            assertThat(auth.get()).isEqualTo("PortOne test-secret");
            assertThat(key.get()).isEqualTo("\"order-cancel-payment-test\"");
            client.cancel("payment-test",5000);
            assertThat(key.get()).isEqualTo("\"order-cancel-payment-test\"");
        } finally {server.stop(0);}
    }

    @Test void providerFailureIsNeverReportedAsCancellationSuccess() throws Exception {
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/payments/payment-test/cancel", exchange -> {exchange.sendResponseHeaders(500,-1);exchange.close();});
        server.start();
        try {
            var client=new PortOnePaymentClient("http://127.0.0.1:"+server.getAddress().getPort(),"test-secret","store-test","channel-test");
            assertThatThrownBy(() -> client.cancel("payment-test",5000)).isInstanceOfSatisfying(BusinessException.class,
                e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE));
        } finally {server.stop(0);}
    }
}
