package com.bulkup.raptor.order.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.cart.repository.CartItemRepository;
import com.bulkup.raptor.product.domain.Product;
import com.bulkup.raptor.product.domain.ProductCategory;
import com.bulkup.raptor.product.repository.ProductRepository;
import com.bulkup.raptor.role.repository.RoleRepository;
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
class OrderApiIntegrationTest {
    @LocalServerPort int port;
    @Autowired com.bulkup.raptor.order.repository.OrderRepository orders;
    @Autowired com.bulkup.raptor.order.application.service.OrderService orderService;
    @Autowired jakarta.persistence.EntityManager entityManager;
    @Autowired MemberRepository members;
    @Autowired RoleRepository roles;
    @Autowired ProductRepository products;
    @Autowired CartItemRepository items;
    @Autowired PasswordEncoder encoder;
    @Autowired TransactionTemplate transactions;
    final JsonMapper json = JsonMapper.builder().build();
    final String password = "CartTest123";
    final List<Long> memberIds = new ArrayList<>();
    final List<Long> productIds = new ArrayList<>();
    Member owner;
    Product product;
    HttpClient client;

    @BeforeEach
    void setup() throws Exception {
        owner = member();
        product = products.saveAndFlush(Product.create("장바구니 테스트", "설명", 1200,
                ProductCategory.SUPPLEMENT, null, "🥛"));
        productIds.add(product.getId());
        client = login(owner);
    }

    @AfterEach
    void cleanup() {
        transactions.executeWithoutResult(tx -> {
            for (Long id : memberIds) {
                entityManager.createNativeQuery("delete from order_items where order_id in (select id from orders where member_id = :id)")
                        .setParameter("id", id).executeUpdate();
                entityManager.createNativeQuery("delete from orders where member_id = :id")
                        .setParameter("id", id).executeUpdate();
                items.deleteAll(items.findCartItems(id));
            }
            items.flush();
            products.deleteAllById(productIds);
            products.flush();
            members.deleteAllById(memberIds);
        });
    }

    Map<String, Object> request(List<Long> ids, long amount, UUID requestId) {
        return new HashMap<>(Map.of("cartItemIds", ids, "expectedTotalAmount", amount,
                "requestId", requestId.toString(), "recipientName", "테스트 회원", "phone", "01012345678",
                "postalCode", "06236", "address", "서울시 테스트로", "addressDetail", "101호"));
    }

    long addItem(int quantity) throws Exception {
        return body(add(client, quantity, ""), 200).get("items").get(0).get("id").asLong();
    }

    HttpResponse<String> create(HttpClient http, Map<String, Object> request) throws Exception {
        return send(http, "POST", "/api/orders", json.writeValueAsString(request));
    }

    long orderCount() {
        return transactions.execute(tx -> ((Number) entityManager.createNativeQuery(
                "select count(*) from orders where member_id = :id").setParameter("id", owner.getId())
                .getSingleResult()).longValue());
    }

    @Test
    void createsOwnedOrderAndReplaysAfterCartRemoval() throws Exception {
        long itemId = addItem(2);
        var request = request(List.of(itemId), 5400, UUID.randomUUID());
        var response = create(client, request);
        var created = body(response, 201);
        long orderId = created.get("orderId").asLong();
        assertThat(response.headers().firstValue("Location")).contains("/api/orders/" + orderId);
        assertThat(created.get("status").asText()).isEqualTo("CREATED");
        assertThat(created.get("itemsTotal").asLong()).isEqualTo(2400);
        assertThat(created.get("shippingFee").asLong()).isEqualTo(3000);
        assertThat(created.get("items").get(0).get("productName").asText()).isEqualTo(product.getName());
        assertThat(items.findCartItems(owner.getId())).isEmpty();
        assertThat(body(create(client, request), 200)).isEqualTo(created);
        assertThat(body(send(client, "GET", "/api/orders/" + orderId, ""), 200)).isEqualTo(created);
        assertThat(orderCount()).isEqualTo(1);
        request.put("addressDetail", "102호");
        assertThat(create(client, request).statusCode()).isEqualTo(409);
        assertThat(orderCount()).isEqualTo(1);
    }

    @Test
    void rejectsAnonymousOtherMemberAndMissingItems() throws Exception {
        long itemId = addItem(1);
        var request = request(List.of(itemId), 4200, UUID.randomUUID());
        assertThat(create(HttpClient.newHttpClient(), request).statusCode()).isEqualTo(401);
        var stranger = login(member());
        assertThat(create(stranger, request).statusCode()).isEqualTo(404);
        assertThat(orderCount()).isZero();
        long orderId = body(create(client, request), 201).get("orderId").asLong();
        assertThat(send(stranger, "GET", "/api/orders/" + orderId, "").statusCode()).isEqualTo(404);
        assertThat(send(HttpClient.newHttpClient(), "GET", "/api/orders/" + orderId, "").statusCode()).isEqualTo(401);
        assertThat(send(client, "GET", "/api/orders/9223372036854775807", "").statusCode()).isEqualTo(404);
    }

    @Test
    void validatesAmountsInputAndPreservesCartOnFailure() throws Exception {
        long itemId = addItem(1);
        var request = request(List.of(itemId), 1, UUID.randomUUID());
        assertThat(body(create(client, request), 409).get("code").asText()).isEqualTo("ORDER_AMOUNT_CHANGED");
        assertThat(orderCount()).isZero();
        assertThat(items.findCartItems(owner.getId())).hasSize(1);
        var duplicate = request(List.of(itemId, itemId), 4200, UUID.randomUUID());
        assertThat(create(client, duplicate).statusCode()).isEqualTo(400);
        for (var entry : Map.of("cartItemIds", List.of(), "recipientName", " ", "phone", "x",
                "postalCode", "abc", "expectedTotalAmount", -1, "requestId", "bad-id").entrySet()) {
            var invalid = request(List.of(itemId), 4200, UUID.randomUUID());
            invalid.put(entry.getKey(), entry.getValue());
            assertThat(create(client, invalid).statusCode()).as(entry.getKey()).isEqualTo(400);
        }
        var fraction = request(List.of(itemId), 4200, UUID.randomUUID());
        fraction.put("expectedTotalAmount", 4200.5);
        assertThat(create(client, fraction).statusCode()).isEqualTo(400);
    }

    @Test
    void ordersOnlySelectedItemsAndCanonicalizesIdOrder() throws Exception {
        long first = addItem(1);
        var second = products.saveAndFlush(Product.create("두번째", "설명", 49000,
                ProductCategory.SUPPLEMENT, null, "🥛"));
        productIds.add(second.getId());
        long secondId = body(send(client, "POST", "/api/cart/items", "{\"productId\":" + second.getId()
                + ",\"quantity\":1}"), 200).get("items").get(1).get("id").asLong();
        var request = request(List.of(secondId), 52000, UUID.randomUUID());
        assertThat(body(create(client, request), 201).get("totalAmount").asLong()).isEqualTo(52000);
        assertThat(items.findCartItems(owner.getId())).extracting(com.bulkup.raptor.cart.domain.CartItem::getId)
                .containsExactly(first);
        // 다시 담은 두 상품의 합계가 무료 배송 경계를 넘는다.
        secondId = body(send(client, "POST", "/api/cart/items", "{\"productId\":" + second.getId()
                + ",\"quantity\":1}"), 200).get("items").get(1).get("id").asLong();
        request = request(List.of(secondId, first), 50200, UUID.randomUUID());
        var created = body(create(client, request), 201);
        assertThat(created.get("shippingFee").asLong()).isZero();
        request.put("cartItemIds", List.of(first, secondId));
        assertThat(body(create(client, request), 200)).isEqualTo(created);
        var history = body(send(client, "GET", "/api/orders", ""), 200).get("content");
        assertThat(history.size()).isEqualTo(2);
        assertThat(history.get(0).get("orderId").asLong()).isEqualTo(created.get("orderId").asLong());
        assertThat(history.get(0).get("items").size()).isEqualTo(2);
        assertThat(history.get(1).get("items").size()).isEqualTo(1);
    }

    @Test
    void snapshotSurvivesProductChangeAndDeletion() throws Exception {
        long itemId = addItem(1);
        long id = body(create(client, request(List.of(itemId), 4200, UUID.randomUUID())), 201)
                .get("orderId").asLong();
        transactions.executeWithoutResult(tx -> products.findById(product.getId()).orElseThrow()
                .change("변경 이름", "설명", 9999, ProductCategory.SUPPLEMENT, null, "🥛"));
        var after = body(send(client, "GET", "/api/orders/" + id, ""), 200);
        assertThat(after.get("items").get(0).get("unitPrice").asLong()).isEqualTo(1200);
        assertThat(after.get("items").get(0).get("productName").asText()).isEqualTo(product.getName());
        products.deleteById(product.getId());
        after = body(send(client, "GET", "/api/orders/" + id, ""), 200);
        assertThat(after.get("items").get(0).get("productId").isNull()).isTrue();
        assertThat(after.get("totalAmount").asLong()).isEqualTo(4200);
    }

    @Test
    void orderDeliverySnapshotSurvivesAddressBookEditAndDeletion() throws Exception {
        var address = new HashMap<String, Object>(Map.of("label", "집", "recipientName", "원래 수령인", "phone", "01012345678",
                "postalCode", "06236", "address", "원래 주소", "addressDetail", "101호", "defaultAddress", true));
        long addressId = body(send(client, "POST", "/api/auth/me/addresses", json.writeValueAsString(address)), 201).get("id").asLong();
        try {
            var request = request(List.of(addItem(1)), 4200, UUID.randomUUID());
            request.put("recipientName", address.get("recipientName"));
            request.put("address", address.get("address"));
            var created = body(create(client, request), 201);
            long orderId = created.get("orderId").asLong();
            address.put("address", "새 주소");
            assertThat(send(client, "PUT", "/api/auth/me/addresses/" + addressId, json.writeValueAsString(address)).statusCode()).isEqualTo(200);
            var afterEdit = body(send(client, "GET", "/api/orders/" + orderId, ""), 200);
            assertThat(afterEdit.get("delivery")).isEqualTo(created.get("delivery"));
            assertThat(send(client, "DELETE", "/api/auth/me/addresses/" + addressId, "").statusCode()).isEqualTo(204);
            var afterDelete = body(send(client, "GET", "/api/orders/" + orderId, ""), 200);
            assertThat(afterDelete.get("delivery")).isEqualTo(created.get("delivery"));
        } finally {
            // Also clean up on assertion failure so this test does not leave an address behind.
            send(client, "DELETE", "/api/auth/me/addresses/" + addressId, "");
        }
    }

    @Test
    void listsOnlyOwnedOrdersNewestFirstWithPagination() throws Exception {
        long first = body(create(client, request(List.of(addItem(1)), 4200, UUID.randomUUID())), 201).get("orderId").asLong();
        long second = body(create(client, request(List.of(addItem(2)), 5400, UUID.randomUUID())), 201).get("orderId").asLong();
        var page = body(send(client, "GET", "/api/orders?page=0&size=1", ""), 200);
        assertThat(page.get("totalElements").asLong()).isEqualTo(2);
        assertThat(page.get("totalPages").asInt()).isEqualTo(2);
        assertThat(page.get("page").asInt()).isZero();
        assertThat(page.get("content").size()).isEqualTo(1);
        var recent = page.get("content").get(0);
        assertThat(recent.get("orderId").asLong()).isEqualTo(second);
        assertThat(recent.get("totalAmount").asLong()).isEqualTo(5400);
        assertThat(recent.get("items").get(0).get("productName").asText()).isEqualTo(product.getName());
        assertThat(recent.get("items").get(0).get("quantity").asInt()).isEqualTo(2);
        assertThat(recent.has("delivery")).isFalse();
        var older = body(send(client, "GET", "/api/orders?page=1&size=1", ""), 200);
        assertThat(older.get("content").get(0).get("orderId").asLong()).isEqualTo(first);
        var other = body(send(login(member()), "GET", "/api/orders", ""), 200);
        assertThat(other.get("content").size()).isZero();
        assertThat(other.get("totalElements").asLong()).isZero();
        assertThat(send(HttpClient.newHttpClient(), "GET", "/api/orders", "").statusCode()).isEqualTo(401);
        for (var query : List.of("page=-1", "size=0", "size=51", "page=invalid"))
            assertThat(send(client, "GET", "/api/orders?" + query, "").statusCode()).isEqualTo(400);
        assertThat(body(send(client, "GET", "/api/orders?page=2&size=1", ""), 200).get("content").size()).isZero();
    }

    @Test
    void concurrentRetryCreatesExactlyOneOrderAcrossSessions() throws Exception {
        long itemId = addItem(1);
        var request = request(List.of(itemId), 4200, UUID.randomUUID());
        var second = login(owner);
        var gate = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(6)) {
            var futures = new ArrayList<Future<HttpResponse<String>>>();
            for (int i = 0; i < 6; i++) {
                var http = i % 2 == 0 ? client : second;
                futures.add(executor.submit(() -> { gate.await(); return create(http, request); }));
            }
            gate.countDown();
            var responses = new ArrayList<HttpResponse<String>>();
            for (var future : futures) responses.add(future.get(30, TimeUnit.SECONDS));
            assertThat(responses.stream().filter(r -> r.statusCode() == 201).count()).isEqualTo(1);
            assertThat(responses).allMatch(r -> r.statusCode() == 201 || r.statusCode() == 200);
            assertThat(responses.stream().map(r -> json.readTree(r.body()).get("orderId").asLong()).distinct().count()).isEqualTo(1);
        }
        assertThat(orderCount()).isEqualTo(1);
        assertThat(items.findCartItems(owner.getId())).isEmpty();
    }

    @Test
    void rollbackRestoresOrderItemsAndCartTogether() throws Exception {
        long itemId = addItem(1);
        var request = new CreateOrderRequest(List.of(itemId), "회원", "01012345678", "06236",
                "서울", "101호", java.math.BigDecimal.valueOf(4200), UUID.randomUUID());
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> transactions.executeWithoutResult(tx -> {
            orderService.create(owner.getId(), request);
            throw new IllegalStateException("force rollback after order save and cart delete");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(orderCount()).isZero();
        assertThat(items.findCartItems(owner.getId())).hasSize(1);
        assertThat(orderService.create(owner.getId(), request).created()).isTrue();
    }

    Member member() {
        var member = Member.pending(UUID.randomUUID() + "@example.test", encoder.encode(password),
                "Cart test", Instant.now(), roles.findByCode("MEMBER").orElseThrow());
        member.activateAfterEmailVerification();
        member = members.saveAndFlush(member);
        memberIds.add(member.getId());
        return member;
    }

    HttpClient login(Member member) throws Exception {
        var http = HttpClient.newBuilder().cookieHandler(new CookieManager()).build();
        body(send(http, "POST", "/api/auth/login", json.writeValueAsString(Map.of(
                "email", member.getEmail(), "password", password))), 200);
        return http;
    }

    HttpResponse<String> add(HttpClient http, int quantity, String extra) throws Exception {
        return send(http, "POST", "/api/cart/items", "{\"productId\":" + product.getId()
                + ",\"quantity\":" + quantity + extra + "}");
    }

    HttpResponse<String> send(HttpClient http, String method, String path, String body) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .timeout(Duration.ofSeconds(25)).header("Content-Type", "application/json")
                .method(method, HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }

    JsonNode body(HttpResponse<String> response, int status) {
        assertThat(response.statusCode()).as(response.body()).isEqualTo(status);
        return json.readTree(response.body());
    }
}
