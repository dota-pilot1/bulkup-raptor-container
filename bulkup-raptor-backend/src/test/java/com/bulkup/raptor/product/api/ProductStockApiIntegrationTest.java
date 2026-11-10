package com.bulkup.raptor.product.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.product.domain.Product;
import com.bulkup.raptor.product.domain.ProductCategory;
import com.bulkup.raptor.product.repository.ProductRepository;
import com.bulkup.raptor.role.repository.RoleRepository;
import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ProductStockApiIntegrationTest {
    @LocalServerPort int port;
    @Autowired MemberRepository members;
    @Autowired RoleRepository roles;
    @Autowired ProductRepository products;
    @Autowired PasswordEncoder encoder;
    @Autowired JdbcTemplate jdbc;
    final JsonMapper json = JsonMapper.builder().build();
    final List<Long> memberIds = new ArrayList<>();
    final List<Long> productIds = new ArrayList<>();
    final String password = "StockTest123";
    HttpClient operator;

    @BeforeEach
    void setup() throws Exception {
        operator = login(member("OPERATOR"));
    }

    @AfterEach
    void cleanup() {
        products.deleteAllById(productIds);
        members.deleteAllById(memberIds);
    }

    @Test
    void createsInitialStockAndReturnsItInPublicDetailAndList() throws Exception {
        var created = remember(send(operator, "POST", "/api/products", productJson("17")), false);
        long id = created.get("id").asLong();
        assertThat(created.get("stockQuantity").asInt()).isEqualTo(17);
        assertThat(products.findById(id).orElseThrow().getStockQuantity()).isEqualTo(17);
        var detail = body(send(HttpClient.newHttpClient(), "GET", "/api/products/" + id, ""), 200);
        assertThat(detail.get("stockQuantity").asInt()).isEqualTo(17);
        var list = body(send(HttpClient.newHttpClient(), "GET", "/api/products", ""), 200);
        boolean found = false;
        for (var item : list) {
            if (item.get("id").asLong() == id) {
                assertThat(item.get("stockQuantity").asInt()).isEqualTo(17);
                found = true;
            }
        }
        assertThat(found).isTrue();
    }

    @Test
    void supportsZeroMaximumAndLegacyMissingOrNullStock() throws Exception {
        for (String value : new String[]{"0", "2147483647", null, "null"}) {
            var created = remember(send(operator, "POST", "/api/products", productJson(value)), false);
            assertThat(created.get("stockQuantity").asInt()).isEqualTo("2147483647".equals(value) ? Integer.MAX_VALUE : 0);
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"-1", "0.5", "1.0", "2147483648", "\"3\"", "true", "{}", "[]"})
    void rejectsInvalidStockWithoutSavingProduct(String value) throws Exception {
        long before = products.count();
        assertThat(body(send(operator, "POST", "/api/products", productJson(value)), 400).get("code").asText())
                .isEqualTo("INVALID_INPUT");
        assertThat(products.count()).isEqualTo(before);
    }

    @Test
    void multipartRegistrationAndBothUpdatePathsPreserveInitialStock() throws Exception {
        var created = remember(multipart("POST", "/api/products", productJson("9")), true);
        long id = created.get("id").asLong();
        assertThat(created.get("stockQuantity").asInt()).isEqualTo(9);
        for (String value : new String[]{"999", null}) {
            var updated = body(send(operator, "PUT", "/api/products/" + id, productJson(value)), 200);
            assertThat(updated.get("stockQuantity").asInt()).isEqualTo(9);
        }
        var updated = body(multipart("PUT", "/api/products/" + id, productJson("88")), 200);
        assertThat(updated.get("stockQuantity").asInt()).isEqualTo(9);
        assertThat(products.findById(id).orElseThrow().getStockQuantity()).isEqualTo(9);
    }

    @Test
    void creationRetainsProductPermissionGuard() throws Exception {
        assertThat(send(HttpClient.newHttpClient(), "POST", "/api/products", productJson("5")).statusCode()).isEqualTo(401);
        assertThat(send(login(member("MEMBER")), "POST", "/api/products", productJson("5")).statusCode()).isEqualTo(403);
    }

    @Test
    void databaseDefaultsLegacyInsertsToZeroAndRejectsNegativeOrNullStock() {
        Long id = jdbc.queryForObject("""
                INSERT INTO products (name, description, price, category, visual, created_at, updated_at)
                VALUES ('재고 기본값 테스트', '설명', 1000, 'SUPPLEMENT', 'X', now(), now()) RETURNING id
                """, Long.class);
        productIds.add(id);
        assertThat(products.findById(id).orElseThrow().getStockQuantity()).isZero();
        assertThatThrownBy(() -> jdbc.update("UPDATE products SET stock_quantity = -1 WHERE id = ?", id))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("UPDATE products SET stock_quantity = NULL WHERE id = ?", id))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(products.findById(id).orElseThrow().getStockQuantity()).isZero();
    }

    @Test
    void internalFactoriesDefaultToZeroAndRejectNegativeInitialStock() {
        assertThat(Product.create("상품", "설명", 1000, ProductCategory.SUPPLEMENT, null, "X").getStockQuantity()).isZero();
        assertThatThrownBy(() -> Product.create("상품", "설명", 1000, ProductCategory.SUPPLEMENT, null, "X", -1))
                .isInstanceOf(IllegalArgumentException.class);
    }

    String productJson(String stock) {
        return "{\"name\":\"재고 테스트\",\"description\":\"초기 재고\",\"price\":1000,"
                + "\"category\":\"SUPPLEMENT\",\"badge\":\"\",\"visual\":\"X\""
                + (stock == null ? "" : ",\"stockQuantity\":" + stock) + "}";
    }

    Member member(String role) {
        var member = Member.pending(UUID.randomUUID() + "@example.test", encoder.encode(password), "재고 테스트",
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

    HttpResponse<String> send(HttpClient client, String method, String path, String content) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json").method(method, HttpRequest.BodyPublishers.ofString(content)).build(),
                HttpResponse.BodyHandlers.ofString());
    }

    HttpResponse<String> multipart(String method, String path, String content) throws Exception {
        String boundary = "StockTestBoundary";
        String body = "--" + boundary + "\r\nContent-Disposition: form-data; name=\"product\"\r\n"
                + "Content-Type: application/json\r\n\r\n" + content + "\r\n--" + boundary + "--\r\n";
        return operator.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .method(method, HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }

    JsonNode remember(HttpResponse<String> response, boolean multipart) {
        var node = body(response, 201);
        var product = multipart ? node.get("product") : node;
        productIds.add(product.get("id").asLong());
        return product;
    }

    JsonNode body(HttpResponse<String> response, int status) {
        assertThat(response.statusCode()).as(response.body()).isEqualTo(status);
        return json.readTree(response.body());
    }
}
