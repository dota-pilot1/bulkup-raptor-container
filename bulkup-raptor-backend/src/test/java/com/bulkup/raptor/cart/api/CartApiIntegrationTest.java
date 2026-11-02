package com.bulkup.raptor.cart.api;

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
class CartApiIntegrationTest {
    @LocalServerPort int port;
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
                items.deleteAll(items.findCartItems(id));
            }
            items.flush();
            products.deleteAllById(productIds);
            products.flush();
            members.deleteAllById(memberIds);
        });
    }

    @Test
    void addMergeUpdateDeleteAndReloginUsePersistedServerPrices() throws Exception {
        assertThat(body(send(client, "GET", "/api/cart", ""), 200).get("items").size()).isZero();
        var added = body(add(client, 2, ",\"price\":1,\"name\":\"fake\""), 200);
        assertThat(added.get("totalAmount").asLong()).isEqualTo(2400);
        assertThat(added.get("items").get(0).get("product").get("name").asText()).isEqualTo(product.getName());
        long itemId = added.get("items").get(0).get("id").asLong();
        var merged = body(add(client, 3, ""), 200);
        assertThat(merged.get("items").size()).isEqualTo(1);
        assertThat(merged.get("totalQuantity").asLong()).isEqualTo(5);
        assertThat(merged.get("totalAmount").asLong()).isEqualTo(6000);
        assertThat(items.findCartItems(owner.getId())).hasSize(1);
        var relogged = login(owner);
        var persisted = body(send(relogged, "GET", "/api/cart", ""), 200);
        assertThat(persisted).isEqualTo(merged);
        var updated = body(send(relogged, "PATCH", "/api/cart/items/" + itemId, "{\"quantity\":4}"), 200);
        assertThat(updated.get("totalQuantity").asLong()).isEqualTo(4);
        assertThat(updated.get("totalAmount").asLong()).isEqualTo(4800);
        assertThat(send(client, "DELETE", "/api/cart/items/" + itemId, "").statusCode()).isEqualTo(204);
        assertThat(body(send(client, "GET", "/api/cart", ""), 200).get("items").size()).isZero();
    }

    @Test
    void everyEndpointRequiresAuthentication() throws Exception {
        var anonymous = HttpClient.newHttpClient();
        assertThat(send(anonymous, "GET", "/api/cart", "").statusCode()).isEqualTo(401);
        assertThat(add(anonymous, 1, "").statusCode()).isEqualTo(401);
        assertThat(send(anonymous, "PATCH", "/api/cart/items/1", "{\"quantity\":1}").statusCode()).isEqualTo(401);
        assertThat(send(anonymous, "DELETE", "/api/cart/items/1", "").statusCode()).isEqualTo(401);
    }

    @Test
    void otherMembersCannotReadChangeOrDeleteOwnersItem() throws Exception {
        long itemId = body(add(client, 2, ""), 200).get("items").get(0).get("id").asLong();
        var stranger = login(member());
        assertThat(body(send(stranger, "GET", "/api/cart", ""), 200).get("items").size()).isZero();
        assertThat(send(stranger, "PATCH", "/api/cart/items/" + itemId, "{\"quantity\":9}").statusCode()).isEqualTo(404);
        assertThat(send(stranger, "DELETE", "/api/cart/items/" + itemId, "").statusCode()).isEqualTo(404);
        assertThat(body(send(client, "GET", "/api/cart", ""), 200).get("totalQuantity").asLong()).isEqualTo(2);
    }

    @Test
    void rejectsInvalidQuantitiesAndRollsBackExcessiveMerge() throws Exception {
        long id = body(add(client, 98, ""), 200).get("items").get(0).get("id").asLong();
        for (String quantity : List.of("0", "-1", "100", "1.5", "99.9", "null", "2147483648")) {
            String payload = "{\"productId\":" + product.getId() + ",\"quantity\":" + quantity + "}";
            assertThat(send(client, "POST", "/api/cart/items", payload).statusCode()).as(quantity).isEqualTo(400);
            assertThat(send(client, "PATCH", "/api/cart/items/" + id,
                    "{\"quantity\":" + quantity + "}").statusCode()).as(quantity).isEqualTo(400);
        }
        assertThat(send(client, "POST", "/api/cart/items", "{\"productId\":" + product.getId() + "}").statusCode()).isEqualTo(400);
        assertThat(add(client, 2, "").statusCode()).isEqualTo(400);
        assertThat(body(send(client, "GET", "/api/cart", ""), 200).get("totalQuantity").asLong()).isEqualTo(98);
        assertThat(body(add(client, 1, ""), 200).get("totalQuantity").asLong()).isEqualTo(99);
    }

    @Test
    void rejectsUnknownProductAndItems() throws Exception {
        assertThat(send(client, "POST", "/api/cart/items",
                "{\"productId\":9223372036854775807,\"quantity\":1}").statusCode()).isEqualTo(404);
        assertThat(send(client, "PATCH", "/api/cart/items/9223372036854775807", "{\"quantity\":1}").statusCode()).isEqualTo(404);
        assertThat(send(client, "DELETE", "/api/cart/items/9223372036854775807", "").statusCode()).isEqualTo(404);
    }

    @Test
    void readsCurrentProductPriceAndRemovesDeletedProducts() throws Exception {
        body(add(client, 2, ""), 200);
        transactions.executeWithoutResult(tx -> {
            var current = products.findById(product.getId()).orElseThrow();
            current.change("변경 상품", "설명", 2000, ProductCategory.SUPPLEMENT, null, "🥛");
        });
        var refreshed = body(send(client, "GET", "/api/cart", ""), 200);
        assertThat(refreshed.get("totalAmount").asLong()).isEqualTo(4000);
        assertThat(refreshed.get("items").get(0).get("product").get("name").asText()).isEqualTo("변경 상품");
        products.deleteById(product.getId());
        assertThat(body(send(client, "GET", "/api/cart", ""), 200).get("items").size()).isZero();
        assertThat(add(client, 1, "").statusCode()).isEqualTo(404);
    }

    @Test
    void concurrentFirstAddsFromSeparateSessionsProduceOneItemWithoutLostQuantity() throws Exception {
        var secondSession = login(owner);
        var responses = concurrentAdds(client, secondSession, 16);
        assertThat(responses).allMatch(r -> r.statusCode() == 200);
        var cart = body(send(client, "GET", "/api/cart", ""), 200);
        assertThat(cart.get("items").size()).isEqualTo(1);
        assertThat(cart.get("totalQuantity").asLong()).isEqualTo(16);
        assertThat(cart.get("totalAmount").asLong()).isEqualTo(19200);
    }

    @Test
    void concurrentAddsAtLimitAcceptOnlyRemainingCapacity() throws Exception {
        body(add(client, 98, ""), 200);
        var responses = concurrentAdds(client, login(owner), 8);
        assertThat(responses.stream().filter(r -> r.statusCode() == 200).count()).isEqualTo(1);
        assertThat(responses.stream().filter(r -> r.statusCode() == 400).count()).isEqualTo(7);
        assertThat(body(send(client, "GET", "/api/cart", ""), 200).get("totalQuantity").asLong()).isEqualTo(99);
    }

    List<HttpResponse<String>> concurrentAdds(HttpClient first, HttpClient second, int count) throws Exception {
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(count)) {
            List<Future<HttpResponse<String>>> futures = new ArrayList<>();
            for (int i = 0; i < count; i++) {
                var session = i % 2 == 0 ? first : second;
                futures.add(executor.submit(() -> {
                    if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start timeout");
                    return add(session, 1, "");
                }));
            }
            start.countDown();
            List<HttpResponse<String>> results = new ArrayList<>();
            for (var future : futures) results.add(future.get(30, TimeUnit.SECONDS));
            return results;
        }
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
