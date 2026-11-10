package com.bulkup.raptor.payment.api;

import static org.assertj.core.api.Assertions.assertThat;
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
class PaymentApiIntegrationTest {
    @LocalServerPort int port;
    @Autowired MemberRepository members;
    @Autowired RoleRepository roles;
    @Autowired ProductRepository products;
    @Autowired OrderRepository orders;
    @Autowired PaymentRepository payments;
    @Autowired PreparePaymentService service;
    @Autowired com.bulkup.raptor.inventory.application.service.StockReservationService stock;
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
        owner = member();
        product = products.saveAndFlush(Product.create("주문 당시 상품", "설명", 1200,
                ProductCategory.SUPPLEMENT, null, "🥛", 100));
        productIds.add(product.getId());
        orderId = order(owner, false);
        client = login(owner);
    }

    @AfterEach
    void cleanup() {
        transactions.executeWithoutResult(tx -> {
            for (Long id : memberIds) {
                entityManager.createNativeQuery("delete from stock_adjustments where actor_id = :id").setParameter("id", id).executeUpdate();
                entityManager.createNativeQuery("delete from stock_reservations where order_id in (select id from orders where member_id = :id)")
                        .setParameter("id", id).executeUpdate();
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

    @Test
    void createsAndReplaysSavedPreparationWithoutChangingOrder() throws Exception {
        transactions.executeWithoutResult(tx -> products.findById(product.getId()).orElseThrow()
                .change("현재 상품명", "설명", 9900, ProductCategory.SUPPLEMENT, null, "🥛"));
        // 요청 본문의 이름·금액은 사용하지 않고 저장된 주문 정보를 사용한다.
        var created = body(send(client, orderId, "{\"totalAmount\":1,\"orderName\":\"위조 이름\"}"), 201);
        assertThat(created.get("paymentId").asText()).startsWith("payment-");
        assertThat(created.get("orderName").asText()).isEqualTo("주문 당시 상품");
        assertThat(created.get("totalAmount").asLong()).isEqualTo(5400);
        assertThat(created.get("currency").asText()).isEqualTo("KRW");
        assertThat(created.size()).isEqualTo(6);
        assertThat(body(prepare(client, orderId), 200)).isEqualTo(created);
        assertThat(paymentCount()).isEqualTo(1);
        assertThat(payments.findById(created.get("paymentId").asText()).orElseThrow().getStatus().name()).isEqualTo("READY");
        assertThat(orders.findById(orderId).orElseThrow().getStatus()).isEqualTo("CREATED");
    }

    @Test
    void createsSummaryNameFromOrderedItemSnapshotsAndAllowsSeparateOrders() throws Exception {
        var first = body(prepare(client, orderId), 201);
        var second = body(prepare(client, order(owner, true)), 201);
        assertThat(second.get("orderName").asText()).isEqualTo("주문 당시 상품 외 1종");
        assertThat(second.get("totalAmount").asLong()).isEqualTo(6600);
        assertThat(second.get("paymentId").asText()).isNotEqualTo(first.get("paymentId").asText());
        assertThat(paymentCount()).isEqualTo(2);
    }

    @Test
    void rejectsMissingAuthenticationForeignOrdersAndInvalidOrders() throws Exception {
        assertThat(prepare(HttpClient.newHttpClient(), orderId).statusCode()).isEqualTo(401);
        var otherClient = login(member());
        assertThat(body(prepare(otherClient, orderId), 404).get("code").asText()).isEqualTo("ORDER_NOT_FOUND");
        assertThat(prepare(client, Long.MAX_VALUE).statusCode()).isEqualTo(404);
        assertThat(prepare(client, 0).statusCode()).isEqualTo(400);
        assertThat(paymentCount()).isZero();
    }

    @Test
    void newSessionReusesExistingPaymentWithoutRequestBody() throws Exception {
        var created = body(prepare(client, orderId), 201);
        assertThat(body(prepare(login(owner), orderId), 200)).isEqualTo(created);
        assertThat(paymentCount()).isEqualTo(1);
    }

    @Test
    void concurrentRequestsAcrossSessionsCreateOnePayment() throws Exception {
        var secondSession = login(owner);
        var gate = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(6)) {
            var futures = new ArrayList<Future<HttpResponse<String>>>();
            for (int i = 0; i < 6; i++) {
                var http = i % 2 == 0 ? client : secondSession;
                futures.add(executor.submit(() -> { gate.await(); return prepare(http, orderId); }));
            }
            gate.countDown();
            var responses = new ArrayList<HttpResponse<String>>();
            for (var future : futures) responses.add(future.get(30, TimeUnit.SECONDS));
            assertThat(responses.stream().filter(r -> r.statusCode() == 201).count()).isEqualTo(1);
            assertThat(responses).allMatch(r -> r.statusCode() == 201 || r.statusCode() == 200);
            assertThat(responses.stream().map(r -> json.readTree(r.body()).get("paymentId").asText()).distinct().count()).isEqualTo(1);
        }
        assertThat(paymentCount()).isEqualTo(1);
    }

    @Test
    void concurrentDifferentOrdersCreateIndependentPayments() throws Exception {
        long other = order(owner, false);
        var gate = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> { gate.await(); return prepare(client, orderId); });
            var second = executor.submit(() -> { gate.await(); return prepare(client, other); });
            gate.countDown();
            assertThat(body(first.get(30, TimeUnit.SECONDS), 201).get("paymentId").asText())
                    .isNotEqualTo(body(second.get(30, TimeUnit.SECONDS), 201).get("paymentId").asText());
        }
        assertThat(paymentCount()).isEqualTo(2);
    }

    @Test
    void databaseConstraintAndTransactionRollbackPreventExtraRows() throws Exception {
        body(prepare(client, orderId), 201);
        assertThatThrownBy(() -> transactions.executeWithoutResult(tx -> {
            var order = orders.findByIdAndMemberId(orderId, owner.getId()).orElseThrow();
            payments.saveAndFlush(Payment.ready(order));
        })).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
        long otherId = order(owner, false);
        assertThatThrownBy(() -> transactions.executeWithoutResult(tx -> {
            service.prepare(owner.getId(), otherId);
            throw new IllegalStateException("force rollback after save");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(paymentCount()).isEqualTo(1);
        assertThat(service.prepare(owner.getId(), otherId).created()).isTrue();
        assertThat(paymentCount()).isEqualTo(2);
    }

    @Test
    void paidOrderReturnsExistingPaymentWithoutCreatingAnother() throws Exception {
        var created = body(prepare(client, orderId), 201);
        transactions.executeWithoutResult(tx -> {
            stock.confirm(orders.findByIdAndMemberIdForUpdate(orderId, owner.getId()).orElseThrow());
            payments.findByOrderId(orderId).orElseThrow().markPaid(Instant.now(), "tx-replay", null, "KAKAOPAY");
            orders.findById(orderId).orElseThrow().markPaid();
        });
        assertThat(body(prepare(client, orderId), 200).get("inventoryStatus").asText()).isEqualTo("CONFIRMED");
        assertThat(paymentCount()).isEqualTo(1);
        assertThat(orders.findById(orderId).orElseThrow().getStatus()).isEqualTo("PAID");
    }

    long order(Member member, boolean multiple) {
        return transactions.execute(tx -> {
            var order = Order.create(member, UUID.randomUUID(), "test", "수령인", "01012345678", "06236", "서울", "101호");
            order.addItem(product, 2);
            if (multiple) {
                var second = products.saveAndFlush(Product.create("두번째 상품", "설명", 1200,
                        ProductCategory.SUPPLEMENT, null, "🥛", 100));
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
