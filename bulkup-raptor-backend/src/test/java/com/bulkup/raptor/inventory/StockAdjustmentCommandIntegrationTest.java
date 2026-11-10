package com.bulkup.raptor.inventory;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.inventory.api.StockAdjustmentRequest;
import com.bulkup.raptor.inventory.application.service.StockAdjustmentCommandService;
import com.bulkup.raptor.inventory.domain.StockAdjustment;
import com.bulkup.raptor.inventory.repository.StockAdjustmentRepository;
import com.bulkup.raptor.product.domain.Product;
import com.bulkup.raptor.product.domain.ProductCategory;
import com.bulkup.raptor.product.repository.ProductRepository;
import com.bulkup.raptor.role.repository.RoleRepository;
import java.net.CookieManager;
import java.net.URI;
import java.net.http.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class StockAdjustmentCommandIntegrationTest {
    @LocalServerPort int port;
    @Autowired MemberRepository members;
    @Autowired RoleRepository roles;
    @Autowired ProductRepository products;
    @Autowired StockAdjustmentCommandService commands;
    @MockitoSpyBean StockAdjustmentRepository adjustments;
    @Autowired PasswordEncoder encoder;
    @Autowired JdbcTemplate jdbc;
    final JsonMapper json = JsonMapper.builder().build();
    final List<Long> memberIds = new ArrayList<>();
    final List<Long> productIds = new ArrayList<>();
    final String password = "StockCommand123";
    Member actor;
    Product product;
    HttpClient operator;

    @BeforeEach
    void setup() throws Exception {
        actor = member("OPERATOR");
        operator = login(actor);
        product = product(10);
    }

    @AfterEach
    void cleanup() {
        reset(adjustments);
        for (Long id : productIds) {
            jdbc.update("DELETE FROM stock_adjustments WHERE product_id = ?", id);
        }
        products.deleteAllById(productIds);
        members.deleteAllById(memberIds);
    }

    @Test
    void savesStockAndHistoryAndReturnsOnlyAuthenticatedActor() throws Exception {
        var result = body(post(operator, product.getId(), """
                {"delta":-3,"reason":"  파손 차감  ","actorId":999999,"beforeQuantity":999,"afterQuantity":996}
                """), 201);
        assertThat(result.get("beforeQuantity").asInt()).isEqualTo(10);
        assertThat(result.get("afterQuantity").asInt()).isEqualTo(7);
        assertThat(result.get("delta").asInt()).isEqualTo(-3);
        assertThat(result.get("type").asText()).isEqualTo("DECREASE");
        assertThat(result.get("actorId").asLong()).isEqualTo(actor.getId());
        assertThat(result.get("actorName").asText()).isEqualTo(actor.getName());
        assertThat(result.get("reason").asText()).isEqualTo("파손 차감");
        assertThat(Instant.parse(result.get("createdAt").asText())).isNotNull();
        assertThat(stock()).isEqualTo(7);
        assertThat(historyCount()).isEqualTo(1);
        var history = body(send(operator, "GET", path(product.getId()), ""), 200);
        assertThat(history.get("content").get(0).get("id").asLong()).isEqualTo(result.get("id").asLong());
        assertThat(body(send(HttpClient.newHttpClient(), "GET", "/api/products/" + product.getId(), ""), 200)
                .get("stockQuantity").asInt()).isEqualTo(7);
    }

    @Test
    void acceptsReasonBoundsAndStockBounds() throws Exception {
        body(post(operator, product.getId(), request(-10, "x")), 201);
        assertThat(stock()).isZero();
        body(post(operator, product.getId(), request(Integer.MAX_VALUE, "x".repeat(200))), 201);
        assertThat(stock()).isEqualTo(Integer.MAX_VALUE);
        assertThat(body(post(operator, product.getId(), request(1, "入庫")), 409).get("code").asText())
                .isEqualTo("STOCK_QUANTITY_OUT_OF_RANGE");
        assertThat(stock()).isEqualTo(Integer.MAX_VALUE);
        assertThat(historyCount()).isEqualTo(2);
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "0.5", "1.0", "2147483648", "-2147483649", "\"3\"", "true", "{}", "[]", "null"})
    void rejectsInvalidDelta(String delta) throws Exception {
        var result = body(post(operator, product.getId(), "{\"delta\":" + delta + ",\"reason\":\"調整\"}"), 400);
        assertThat(result.get("code").asText()).isEqualTo("INVALID_INPUT");
        assertUnchanged();
    }

    @Test
    void rejectsMissingDeltaInvalidReasonsAndMalformedBody() throws Exception {
        for (String content : new String[]{"{}", "null", "{", "{\"reason\":\"入庫\"}", "{\"delta\":1}",
                request(1, ""), request(1, "  "), request(1, "\u2003"), request(1, "x".repeat(201)),
                "{\"delta\":1,\"reason\":null}"}) {
            body(post(operator, product.getId(), content), 400);
            assertUnchanged();
        }
    }

    @Test
    void rejectsInsufficientStockMissingProductAndInvalidPath() throws Exception {
        assertThat(body(post(operator, product.getId(), request(-11, "차감")), 409).get("code").asText())
                .isEqualTo("STOCK_INSUFFICIENT");
        assertThat(body(post(operator, Long.MAX_VALUE, request(1, "입고")), 404).get("code").asText())
                .isEqualTo("PRODUCT_NOT_FOUND");
        body(post(operator, 0L, request(1, "입고")), 400);
        body(send(operator, "POST", "/api/admin/products/not-a-number/stock-adjustments", request(1, "입고")), 400);
        assertUnchanged();
    }

    @Test
    void enforcesLoginAndSeparateReadAndWritePermissions() throws Exception {
        body(post(HttpClient.newHttpClient(), product.getId(), request(1, "입고")), 401);
        body(post(login(member("MEMBER")), product.getId(), request(1, "입고")), 403);
        var viewer = member("MEMBER");
        var permission = jdbc.queryForObject("SELECT id FROM permissions WHERE code = 'MENU_ADMIN_ACCESS'", Long.class);
        Long roleId = jdbc.queryForObject("INSERT INTO roles (code, name, description, system_role, created_at, updated_at) "
                + "VALUES (?, '재고 조회 테스트', '테스트', false, now(), now()) RETURNING id", Long.class,
                "STOCK_VIEW_" + UUID.randomUUID().toString().replace("-", ""));
        try {
            jdbc.update("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)", roleId, permission);
            jdbc.update("INSERT INTO member_roles (member_id, role_id) VALUES (?, ?)", viewer.getId(), roleId);
            var client = login(viewer);
            body(send(client, "GET", path(product.getId()), ""), 200);
            body(post(client, product.getId(), request(1, "입고")), 403);
        } finally {
            jdbc.update("DELETE FROM member_roles WHERE role_id = ?", roleId);
            jdbc.update("DELETE FROM role_permissions WHERE role_id = ?", roleId);
            jdbc.update("DELETE FROM roles WHERE id = ?", roleId);
        }
        assertUnchanged();
    }

    @Test
    void rollsBackStockWhenHistorySaveFails() {
        doThrow(new IllegalStateException("이력 저장 실패 테스트")).when(adjustments).save(any(StockAdjustment.class));
        assertThatThrownBy(() -> commands.create(product.getId(), actor.getId(), new StockAdjustmentRequest(-3, "롤백")))
                .isInstanceOf(IllegalStateException.class);
        assertUnchanged();
    }

    @Test
    void concurrentIncreaseAndDecreaseKeepBothChangesAndContinuousHistory() throws Exception {
        var responses = concurrent(5, -3);
        assertThat(responses).allSatisfy(response -> body(response, 201));
        assertThat(stock()).isEqualTo(12);
        assertThat(historyCount()).isEqualTo(2);
        var rows = jdbc.queryForList("SELECT before_quantity, after_quantity FROM stock_adjustments "
                + "WHERE product_id = ? ORDER BY id", product.getId());
        assertThat(rows.get(0).get("before_quantity")).isEqualTo(10);
        assertThat(rows.get(0).get("after_quantity")).isEqualTo(rows.get(1).get("before_quantity"));
        assertThat(rows.get(1).get("after_quantity")).isEqualTo(12);
    }

    @Test
    void concurrentDecreasesCannotOversell() throws Exception {
        assertThat(concurrent(-7, -7).stream().map(HttpResponse::statusCode).toList())
                .containsExactlyInAnyOrder(201, 409);
        assertThat(stock()).isEqualTo(3);
        assertThat(historyCount()).isEqualTo(1);
    }

    List<HttpResponse<String>> concurrent(int first, int second) throws Exception {
        var gate = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var one = executor.submit(() -> { gate.await(); return post(operator, product.getId(), request(first, "동시 변경")); });
            var two = executor.submit(() -> { gate.await(); return post(operator, product.getId(), request(second, "동시 변경")); });
            gate.countDown();
            return List.of(one.get(15, TimeUnit.SECONDS), two.get(15, TimeUnit.SECONDS));
        }
    }

    Product product(int stock) {
        var result = products.saveAndFlush(Product.create("재고 변경 " + UUID.randomUUID(), "설명", 1000,
                ProductCategory.SUPPLEMENT, null, "X", stock));
        productIds.add(result.getId());
        return result;
    }

    Member member(String role) {
        var member = Member.pending(UUID.randomUUID() + "@example.test", encoder.encode(password), "재고 담당자",
                Instant.now(), roles.findByCode(role).orElseThrow());
        member.activateAfterEmailVerification();
        member = members.saveAndFlush(member);
        memberIds.add(member.getId());
        return member;
    }

    HttpClient login(Member member) throws Exception {
        var client = HttpClient.newBuilder().cookieHandler(new CookieManager()).build();
        body(send(client, "POST", "/api/auth/login", json.writeValueAsString(Map.of(
                "email", member.getEmail(), "password", password))), 200);
        return client;
    }

    String path(Long id) { return "/api/admin/products/" + id + "/stock-adjustments"; }
    String request(int delta, String reason) { return json.writeValueAsString(Map.of("delta", delta, "reason", reason)); }
    HttpResponse<String> post(HttpClient client, Long id, String content) throws Exception {
        return send(client, "POST", path(id), content);
    }
    HttpResponse<String> send(HttpClient client, String method, String path, String content) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .timeout(java.time.Duration.ofSeconds(15)).header("Content-Type", "application/json")
                .method(method, HttpRequest.BodyPublishers.ofString(content)).build(), HttpResponse.BodyHandlers.ofString());
    }
    JsonNode body(HttpResponse<String> response, int status) {
        assertThat(response.statusCode()).as(response.body()).isEqualTo(status);
        return json.readTree(response.body());
    }
    int stock() { return jdbc.queryForObject("SELECT stock_quantity FROM products WHERE id = ?", Integer.class, product.getId()); }
    long historyCount() { return jdbc.queryForObject("SELECT count(*) FROM stock_adjustments WHERE product_id = ?", Long.class, product.getId()); }
    void assertUnchanged() {
        assertThat(stock()).isEqualTo(10);
        assertThat(historyCount()).isZero();
    }
}
