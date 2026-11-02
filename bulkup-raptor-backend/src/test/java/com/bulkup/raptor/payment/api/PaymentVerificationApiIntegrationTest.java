package com.bulkup.raptor.payment.api;

import static org.assertj.core.api.Assertions.assertThat;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.util.concurrent.atomic.*;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.order.domain.Order;
import com.bulkup.raptor.order.repository.OrderRepository;
import com.bulkup.raptor.payment.application.service.PreparePaymentService;
import com.bulkup.raptor.payment.domain.Payment;
import com.bulkup.raptor.payment.repository.PaymentRepository;
import com.bulkup.raptor.product.domain.Product;
import com.bulkup.raptor.product.domain.ProductCategory;
import com.bulkup.raptor.product.repository.ProductRepository;
import com.bulkup.raptor.role.repository.RoleRepository;
import jakarta.persistence.EntityManager;
import java.net.CookieManager;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class PaymentVerificationApiIntegrationTest {
    @LocalServerPort int port;
    @Autowired MemberRepository members;
    @Autowired RoleRepository roles;
    @Autowired ProductRepository products;
    @Autowired OrderRepository orders;
    @Autowired PaymentRepository payments;
    @Autowired PreparePaymentService service;
    @Autowired PasswordEncoder encoder;
    @Autowired TransactionTemplate transactions;
    @Autowired EntityManager entityManager;
    final JsonMapper json = JsonMapper.builder().build();
    final List<Long> memberIds = new ArrayList<>();
    final List<Long> productIds = new ArrayList<>();
    final String password = "PaymentTest123";
    Member owner;
    Product product;
    long orderId;
    HttpClient client;

    @BeforeEach
    void setup() throws Exception {
        fakeStatus = 200; overrides.clear(); calls.set(0); delayFirst = false;
        owner = member();
        product = products.saveAndFlush(Product.create("주문 당시 상품", "설명", 1200,
                ProductCategory.SUPPLEMENT, null, "🥛"));
        productIds.add(product.getId());
        orderId = order(owner, false);
        client = login(owner);
    }

    @AfterEach
    void cleanup() {
        transactions.executeWithoutResult(tx -> {
            for (Long id : memberIds) {
                entityManager.createNativeQuery("delete from payments where member_id = :id")
                        .setParameter("id", id).executeUpdate();
                entityManager.createNativeQuery("delete from order_items where order_id in (select id from orders where member_id = :id)")
                        .setParameter("id", id).executeUpdate();
                entityManager.createNativeQuery("delete from orders where member_id = :id")
                        .setParameter("id", id).executeUpdate();
            }
            products.deleteAllById(productIds);
            products.flush();
            members.deleteAllById(memberIds);
        });
    }

    static final Map<String, Object> overrides = new ConcurrentHashMap<>();
    static final AtomicInteger calls = new AtomicInteger();
    static volatile int fakeStatus = 200;
    static volatile boolean delayFirst;
    static CountDownLatch firstStarted;
    static CountDownLatch releaseFirst;
    static final HttpServer fake = startProvider();

    static HttpServer startProvider() {
        try {
            var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.setExecutor(Executors.newCachedThreadPool(r -> { var thread = new Thread(r); thread.setDaemon(true); return thread; }));
            server.createContext("/payments/", exchange -> {
                int number = calls.incrementAndGet();
                String id = exchange.getRequestURI().getPath().substring("/payments/".length());
                var data = new HashMap<String, Object>();
                data.put("id", id); data.put("storeId", "store-test"); data.put("channel", Map.of("key", "channel-key-test"));
                data.put("status", "PAID"); data.put("amount", Map.of("total", 5400, "cancelled", 0));
                data.put("currency", "KRW"); data.put("paidAt", "2026-11-01T04:00:00Z");
                data.put("transactionId", "tx-test"); data.put("pgTxId", "pg-test");
                data.put("method", Map.of("provider", "KAKAOPAY"));
                data.putAll(overrides);
                if (delayFirst && number == 1) {
                    data.put("status", "READY");
                    firstStarted.countDown();
                    try { releaseFirst.await(10, TimeUnit.SECONDS); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                }
                int status = fakeStatus;
                if (!"PortOne fake-secret".equals(exchange.getRequestHeaders().getFirst("Authorization"))) status = 401;
                var bytes = JsonMapper.builder().build().writeValueAsString(data).getBytes(java.nio.charset.StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(status, bytes.length);
                try (var out = exchange.getResponseBody()) { out.write(bytes); }
            });
            server.start(); return server;
        } catch (Exception e) { throw new ExceptionInInitializerError(e); }
    }

    @DynamicPropertySource
    static void configure(DynamicPropertyRegistry registry) {
        registry.add("app.portone.webhook-secret", () -> webhookSecret);
        registry.add("app.portone.base-url", () -> "http://127.0.0.1:" + fake.getAddress().getPort());
        registry.add("app.portone.api-secret", () -> "fake-secret");
        registry.add("app.portone.store-id", () -> "store-test");
        registry.add("app.portone.channel-key", () -> "channel-key-test");
    }

    @AfterAll static void stopProvider() { fake.stop(0); }

    String prepared() throws Exception {
        return body(prepare(client, orderId), 201).get("paymentId").asText();
    }
    HttpResponse<String> verify(HttpClient http, String path) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .timeout(Duration.ofSeconds(25)).POST(HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
    }
    String path(String paymentId) { return "/api/orders/" + orderId + "/payments/" + paymentId + "/verify"; }
    void assertUnpaid(String id) {
        assertThat(payments.findById(id).orElseThrow().getWebhookVerifiedAt()).isNull();
        assertThat(payments.findById(id).orElseThrow().getStatus().name()).isEqualTo("READY");
        assertThat(orders.findById(orderId).orElseThrow().getStatus()).isEqualTo("CREATED");
    }

    @Test void verifiesPaidAndReplaysWithoutExtraPayments() throws Exception {
        var id = prepared();
        var result = body(verify(client, path(id)), 200);
        assertThat(result.get("paymentStatus").asText()).isEqualTo("PAID");
        assertThat(result.get("orderStatus").asText()).isEqualTo("PAID");
        assertThat(result.get("totalAmount").asLong()).isEqualTo(5400);
        assertThat(result.get("transactionId").asText()).isEqualTo("tx-test");
        assertThat(result.get("paidAt").asText()).isEqualTo("2026-11-01T04:00:00Z");
        assertThat(result.get("canRetry").asBoolean()).isFalse();
        assertThat(body(verify(client, path(id)), 200)).isEqualTo(result);
        assertThat(body(verify(client, "/api/orders/" + orderId + "/payments/verify"), 200)).isEqualTo(result);
        assertThat(body(verify(client, "/api/payments/" + id + "/verify"), 200)).isEqualTo(result);
        assertThat(paymentCount()).isEqualTo(1);
        assertThat(orders.findById(orderId).orElseThrow().getStatus()).isEqualTo("PAID");
    }

    @Test void rejectsAnonymousForeignAndWrongOrderBeforeCallingProvider() throws Exception {
        var id = prepared();
        assertThat(verify(HttpClient.newHttpClient(), path(id)).statusCode()).isEqualTo(401);
        var stranger = login(member());
        assertThat(verify(stranger, path(id)).statusCode()).isEqualTo(404);
        assertThat(verify(stranger, "/api/payments/" + id + "/verify").statusCode()).isEqualTo(404);
        assertThat(verify(stranger, "/api/orders/" + orderId + "/payments/verify").statusCode()).isEqualTo(404);
        assertThat(verify(client, "/api/orders/" + order(owner, false) + "/payments/" + id + "/verify").statusCode()).isEqualTo(404);
        assertThat(verify(client, "/api/payments/missing/verify").statusCode()).isEqualTo(404);
        assertThat(calls).hasValue(0);
        assertUnpaid(id);
    }

    @Test void rejectsMismatchedIdentityStoreChannelAmountCurrencyAndCancelledAmount() throws Exception {
        var id = prepared();
        var variations = List.<Map<String, Object>>of(Map.of("id", "other"), Map.of("storeId", "other"),
                Map.of("channel", Map.of("key", "other")), Map.of("amount", Map.of("total", 1)),
                Map.of("currency", "USD"), Map.of("amount", Map.of("total", 5400, "cancelled", 1)),
                Map.of("paidAt", ""), Map.of("transactionId", ""));
        for (var values : variations) {
            overrides.clear(); overrides.putAll(values);
            assertThat(verify(client, path(id)).statusCode()).isEqualTo(409);
            assertUnpaid(id);
        }
    }

    @Test void onlyConfirmedUnpaidCanRetryAndErrorsDoNotMarkPaid() throws Exception {
        var id = prepared();
        for (var status : List.of("READY", "FAILED", "PENDING", "VIRTUAL_ACCOUNT_ISSUED", "CANCELLED", "PARTIAL_CANCELLED")) {
            overrides.put("status", status);
            var result = body(verify(client, path(id)), 200);
            assertThat(result.get("canRetry").asBoolean()).isEqualTo(Set.of("READY", "FAILED").contains(status));
            assertUnpaid(id);
        }
        fakeStatus = 404; overrides.put("type", "PAYMENT_NOT_FOUND");
        assertThat(body(verify(client, path(id)), 200).get("canRetry").asBoolean()).isTrue();
        overrides.put("type", "UnknownError");
        assertThat(verify(client, path(id)).statusCode()).isEqualTo(502);
        for (int status : List.of(302, 401, 500)) {
            fakeStatus = status;
            assertThat(verify(client, path(id)).statusCode()).isEqualTo(502);
        }
        fakeStatus = 200; overrides.clear(); overrides.put("amount", Map.of("total", "5400"));
        assertThat(verify(client, path(id)).statusCode()).isEqualTo(502);
        assertUnpaid(id);
    }

    @Test void concurrentVerificationCommitsOnePaidPayment() throws Exception {
        var id = prepared();
        var gate = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(6)) {
            var futures = new ArrayList<Future<HttpResponse<String>>>();
            for (int i = 0; i < 6; i++) futures.add(executor.submit(() -> { gate.await(); return verify(client, path(id)); }));
            // 여섯 요청을 동시에 시작해 같은 결제가 중복 생성되지 않는지 확인한다.
            gate.countDown();
            for (var future : futures) assertThat(body(future.get(20, TimeUnit.SECONDS), 200).get("orderStatus").asText()).isEqualTo("PAID");
        }
        assertThat(paymentCount()).isEqualTo(1);
    }

    @Test void failedOrderWriteRollsBackPaymentWrite() throws Exception {
        var id = prepared();
        // 주문 저장만 실패하도록 임시 제약을 걸어, 결제 변경도 함께 취소되는지 확인한다.
        transactions.executeWithoutResult(tx -> entityManager.createNativeQuery("alter table orders add constraint step4_rollback_test check (id <> " + orderId + " or status = 'CREATED')").executeUpdate());
        try {
            assertThat(verify(client, path(id)).statusCode()).isGreaterThanOrEqualTo(400);
            assertUnpaid(id);
        } finally {
            transactions.executeWithoutResult(tx -> entityManager.createNativeQuery("alter table orders drop constraint step4_rollback_test").executeUpdate());
        }
    }

    @Test void lateUnpaidSnapshotCannotDowngradePaidResult() throws Exception {
        var id = prepared();
        firstStarted = new CountDownLatch(1); releaseFirst = new CountDownLatch(1); delayFirst = true;
        try (var executor = Executors.newSingleThreadExecutor()) {
            var late = executor.submit(() -> verify(client, path(id)));
            assertThat(firstStarted.await(10, TimeUnit.SECONDS)).isTrue();
            // 두 번째 요청을 먼저 완료한 뒤, 대기 중인 첫 요청의 미결제 응답을 도착시킨다.
            body(verify(client, path(id)), 200);
            releaseFirst.countDown();
            assertThat(late.get(10, TimeUnit.SECONDS).statusCode()).isEqualTo(409);
        } finally { releaseFirst.countDown(); }
        assertThat(payments.findById(id).orElseThrow().getStatus().name()).isEqualTo("PAID");
        assertThat(orders.findById(orderId).orElseThrow().getStatus()).isEqualTo("PAID");
    }

    static final String webhookSecret = "whsec_" + Base64.getEncoder().encodeToString(
            "step5-local-test-secret-only".getBytes(java.nio.charset.StandardCharsets.UTF_8));

    String paidEvent(String id) {
        return json.writeValueAsString(Map.of("type", "Transaction.Paid", "timestamp", Instant.now().toString(),
                "data", Map.of("storeId", "store-test", "paymentId", id), "note", "한글 원문 서명 검증"));
    }

    HttpResponse<String> webhook(String payload) throws Exception {
        return webhook(payload, payload, Instant.now().getEpochSecond());
    }

    HttpResponse<String> webhook(String payload, String signedPayload, long timestamp) throws Exception {
        String eventId = "msg-local-step5";
        // 검증 라이브러리와 별개로 HMAC을 계산해 실제 HTTP 요청을 서명한다.
        var mac = javax.crypto.Mac.getInstance("HmacSHA256");
        mac.init(new javax.crypto.spec.SecretKeySpec(Base64.getDecoder().decode(webhookSecret.substring(6)), "HmacSHA256"));
        String signature = "v1," + Base64.getEncoder().encodeToString(mac.doFinal(
                (eventId + "." + timestamp + "." + signedPayload).getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        return HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/payments/webhooks/portone"))
                .timeout(Duration.ofSeconds(25)).header("Content-Type", "application/json")
                .header("webhook-id", eventId).header("webhook-timestamp", Long.toString(timestamp))
                .header("webhook-signature", signature).POST(HttpRequest.BodyPublishers.ofString(payload)).build(), HttpResponse.BodyHandlers.ofString());
    }

    @Test void signedWebhookCompletesPaymentWithoutBrowserAndReplaysSafely() throws Exception {
        var id = prepared();
        var payload = paidEvent(id);
        assertThat(payments.findById(id).orElseThrow().getWebhookVerifiedAt()).isNull();
        assertThat(webhook(payload).statusCode()).isEqualTo(200);
        var first = payments.findById(id).orElseThrow();
        assertThat(first.getStatus().name()).isEqualTo("PAID");
        assertThat(first.getTotalAmount()).isEqualTo(5400);
        assertThat(first.getWebhookVerifiedAt()).isNotNull();
        assertThat(orders.findById(orderId).orElseThrow().getStatus()).isEqualTo("PAID");
        assertThat(webhook(payload).statusCode()).isEqualTo(200);
        assertThat(payments.findById(id).orElseThrow().getPaidAt()).isEqualTo(first.getPaidAt());
        assertThat(payments.findById(id).orElseThrow().getWebhookVerifiedAt()).isEqualTo(first.getWebhookVerifiedAt());
        assertThat(body(verify(client, path(id)), 200).get("paymentStatus").asText()).isEqualTo("PAID");
        assertThat(paymentCount()).isEqualTo(1);
    }

    @Test void webhookRecordsVerificationAfterBrowserAlreadyCompletedPayment() throws Exception {
        var id = prepared();
        body(verify(client, path(id)), 200);
        var browserPaid = payments.findById(id).orElseThrow();
        assertThat(browserPaid.getStatus().name()).isEqualTo("PAID");
        assertThat(browserPaid.getWebhookVerifiedAt()).isNull();

        assertThat(webhook(paidEvent(id)).statusCode()).isEqualTo(200);
        var webhookVerified = payments.findById(id).orElseThrow();
        assertThat(webhookVerified.getWebhookVerifiedAt()).isNotNull();
        assertThat(webhookVerified.getPaidAt()).isEqualTo(browserPaid.getPaidAt());
    }

    @Test void invalidWebhookSignaturesAndTimestampsNeverReachProvider() throws Exception {
        var id = prepared();
        String payload = paidEvent(id);
        assertThat(webhook(payload + " ", payload, Instant.now().getEpochSecond()).statusCode()).isEqualTo(400);
        assertThat(webhook(payload, payload, Instant.now().minusSeconds(600).getEpochSecond()).statusCode()).isEqualTo(400);
        assertThat(webhook(payload, payload, Instant.now().plusSeconds(600).getEpochSecond()).statusCode()).isEqualTo(400);
        var unsigned = HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/payments/webhooks/portone"))
                .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(payload)).build(), HttpResponse.BodyHandlers.ofString());
        assertThat(unsigned.statusCode()).isEqualTo(400);
        assertThat(calls).hasValue(0);
        assertUnpaid(id);
    }

    @Test void signedUnsupportedEventsAndUnknownPaymentsAreAcknowledged() throws Exception {
        var id = prepared();
        for (String event : List.of("Transaction.Ready", "Transaction.Cancelled", "Future.Event"))
            assertThat(webhook(json.writeValueAsString(Map.of("type", event, "extra", true))).statusCode()).isEqualTo(200);
        assertThat(webhook(paidEvent("payment-not-in-this-database")).statusCode()).isEqualTo(200);
        assertThat(calls).hasValue(0);
        assertUnpaid(id);
    }

    @Test void signedMalformedPayloadAndWrongStoreAreRejected() throws Exception {
        var id = prepared();
        for (String malformed : List.of("not-json", "null", "[]", "{}", "{\"type\":17}",
                "{\"type\":\"Transaction.Paid\",\"data\":{}}"))
            assertThat(webhook(malformed).statusCode()).isEqualTo(400);
        assertThat(webhook(paidEvent(id).replace("store-test", "store-other")).statusCode()).isEqualTo(409);
        assertThat(calls).hasValue(0);
        assertUnpaid(id);
    }

    @Test void webhookUsesProviderAmountAndRejectsFailedOrNotYetPaidLookups() throws Exception {
        var id = prepared();
        overrides.put("amount", Map.of("total", 1));
        assertThat(webhook(paidEvent(id)).statusCode()).isEqualTo(409);
        assertUnpaid(id);
        overrides.clear(); overrides.put("status", "READY");
        assertThat(webhook(paidEvent(id)).statusCode()).isEqualTo(502);
        assertUnpaid(id);
        fakeStatus = 500;
        assertThat(webhook(paidEvent(id)).statusCode()).isEqualTo(502);
        assertUnpaid(id);
        fakeStatus = 404; overrides.put("type", "PAYMENT_NOT_FOUND");
        assertThat(webhook(paidEvent(id)).statusCode()).isEqualTo(502);
        assertUnpaid(id);
        // 조회 실패를 성공 처리하지 않아, 이후 재전송에서 완료할 수 있다.
        fakeStatus = 200; overrides.clear();
        assertThat(webhook(paidEvent(id)).statusCode()).isEqualTo(200);
        assertThat(payments.findById(id).orElseThrow().getStatus().name()).isEqualTo("PAID");
    }

    @Test void browserAndWebhookCanCompleteConcurrently() throws Exception {
        var id = prepared();
        var gate = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(6)) {
            var futures = new ArrayList<Future<HttpResponse<String>>>();
            for (int i = 0; i < 6; i++) {
                boolean fromWebhook = i % 2 == 0;
                futures.add(executor.submit(() -> { gate.await(); return fromWebhook ? webhook(paidEvent(id)) : verify(client, path(id)); }));
            }
            gate.countDown();
            for (var result : futures) assertThat(result.get(30, TimeUnit.SECONDS).statusCode()).isEqualTo(200);
        }
        assertThat(paymentCount()).isEqualTo(1);
        assertThat(payments.findById(id).orElseThrow().getStatus().name()).isEqualTo("PAID");
        assertThat(orders.findById(orderId).orElseThrow().getStatus()).isEqualTo("PAID");
    }

    @Test void webhookCanReflectPaymentAfterMemberWasSuspended() throws Exception {
        var id = prepared();
        transactions.executeWithoutResult(tx -> entityManager.createNativeQuery("update members set status = 'SUSPENDED' where id = :id")
                .setParameter("id", owner.getId()).executeUpdate());
        assertThat(webhook(paidEvent(id)).statusCode()).isEqualTo(200);
        assertThat(payments.findById(id).orElseThrow().getStatus().name()).isEqualTo("PAID");
        // 프런트 검증 API의 로그인 검사는 그대로 유지한다.
        assertThat(verify(HttpClient.newHttpClient(), path(id)).statusCode()).isEqualTo(401);
    }

    @Test void lateUnpaidWebhookCannotDowngradeBrowserVerifiedPayment() throws Exception {
        var id = prepared();
        firstStarted = new CountDownLatch(1); releaseFirst = new CountDownLatch(1); delayFirst = true;
        try (var executor = Executors.newSingleThreadExecutor()) {
            var late = executor.submit(() -> webhook(paidEvent(id)));
            assertThat(firstStarted.await(10, TimeUnit.SECONDS)).isTrue();
            body(verify(client, path(id)), 200);
            releaseFirst.countDown();
            assertThat(late.get(10, TimeUnit.SECONDS).statusCode()).isEqualTo(502);
        } finally { releaseFirst.countDown(); }
        assertThat(payments.findById(id).orElseThrow().getStatus().name()).isEqualTo("PAID");
        assertThat(orders.findById(orderId).orElseThrow().getStatus()).isEqualTo("PAID");
    }

    long order(Member member, boolean multiple) {
        return transactions.execute(tx -> {
            var order = Order.create(member, UUID.randomUUID(), "test", "수령인", "01012345678", "06236", "서울", "101호");
            order.addItem(product, 2);
            if (multiple) {
                var second = products.saveAndFlush(Product.create("두번째 상품", "설명", 1200,
                        ProductCategory.SUPPLEMENT, null, "🥛"));
                productIds.add(second.getId());
                order.addItem(second, 1);
            }
            order.calculateShipping();
            return orders.saveAndFlush(order).getId();
        });
    }

    long paymentCount() {
        return transactions.execute(tx -> ((Number) entityManager.createNativeQuery(
                "select count(*) from payments where member_id = :id")
                .setParameter("id", owner.getId()).getSingleResult()).longValue());
    }

    Member member() {
        var member = Member.pending(UUID.randomUUID() + "@example.test", encoder.encode(password),
                "결제 테스트", Instant.now(), roles.findByCode("MEMBER").orElseThrow());
        member.activateAfterEmailVerification();
        member = members.saveAndFlush(member);
        memberIds.add(member.getId());
        return member;
    }

    HttpClient login(Member member) throws Exception {
        var http = HttpClient.newBuilder().cookieHandler(new CookieManager()).build();
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/auth/login"))
                .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(
                        json.writeValueAsString(Map.of("email", member.getEmail(), "password", password)))).build();
        body(http.send(request, HttpResponse.BodyHandlers.ofString()), 200);
        return http;
    }

    HttpResponse<String> prepare(HttpClient client, long order) throws Exception {
        return send(client, order, "");
    }

    HttpResponse<String> send(HttpClient client, long order, String body) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/orders/" + order + "/payments"))
                .timeout(Duration.ofSeconds(25)).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }

    JsonNode body(HttpResponse<String> response, int status) {
        assertThat(response.statusCode()).as(response.body()).isEqualTo(status);
        return json.readTree(response.body());
    }
}
