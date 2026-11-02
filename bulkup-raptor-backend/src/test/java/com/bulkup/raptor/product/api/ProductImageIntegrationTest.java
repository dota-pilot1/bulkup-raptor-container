package com.bulkup.raptor.product.api;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.image.application.port.ImageStorage;
import com.bulkup.raptor.image.repository.UploadedImageRepository;
import com.bulkup.raptor.product.repository.ProductRepository;
import com.bulkup.raptor.role.repository.RoleRepository;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.net.CookieManager;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ProductImageIntegrationTest {
    @LocalServerPort int port;
    @Autowired MemberRepository members;
    @Autowired RoleRepository roles;
    @Autowired UploadedImageRepository images;
    @Autowired ProductRepository products;
    @Autowired TransactionTemplate transactions;
    @Autowired PasswordEncoder encoder;
    @MockitoBean ImageStorage storage;
    final JsonMapper json = JsonMapper.builder().build();
    final String password = "ProductTest123";
    final List<Long> memberIds = new ArrayList<>();
    final List<Long> productIds = new ArrayList<>();
    Member operator;
    String productJson;
    HttpClient client;

    @BeforeEach
    void setup() throws Exception {
        operator = member("OPERATOR");
        client = login(operator);
        productJson = """
                {"name":"상품 이미지 테스트", "description":"선택 이미지", "price":1000,
                 "category":"SUPPLEMENT", "badge":"", "visual":"🥛"}
                """;
        when(storage.upload(anyString(), any(byte[].class), anyString()))
                .thenAnswer(call -> "https://images.example.test/" + call.getArgument(0));
    }

    @AfterEach
    void cleanup() {
        transactions.executeWithoutResult(tx -> {
            products.deleteAllById(productIds);
            products.flush();
            var ownedImages = images.findAll().stream()
                    .filter(image -> memberIds.contains(image.getUploaderMemberId())).toList();
            images.deleteAll(ownedImages);
            images.flush();
            members.deleteAllById(memberIds);
        });
    }

    @Test
    void oneRequestUploadsAndCreatesThenGetListAndUpdateKeepTheImage() throws Exception {
        var response = multipart(client, productJson, png(), "image/png");
        assertThat(response.statusCode()).isEqualTo(201);
        var body = json.readTree(response.body());
        assertThat(body.get("imageUploadError").isNull()).isTrue();
        var product = body.get("product");
        long id = remember(product);
        String url = product.get("imageUrl").asText();
        String key = url.substring("https://images.example.test/".length());
        assertThat(images.findById(key).orElseThrow().getUploaderMemberId()).isEqualTo(operator.getId());
        assertThat(json.readTree(send(HttpClient.newHttpClient(), "GET", "/api/products/" + id, "").body())
                .get("imageUrl").asText()).isEqualTo(url);
        var list = json.readTree(send(HttpClient.newHttpClient(), "GET", "/api/products", "").body());
        boolean found = false;
        for (int i = 0; i < list.size(); i++) {
            if (list.get(i).get("id").asLong() == id) {
                assertThat(list.get(i).get("imageUrl").asText()).isEqualTo(url);
                found = true;
            }
        }
        assertThat(found).isTrue();
        var updated = send(login(operator), "PUT", "/api/products/" + id, productJson);
        assertThat(updated.statusCode()).isEqualTo(200);
        assertThat(json.readTree(updated.body()).get("imageUrl").asText()).isEqualTo(url);
        verify(storage, times(1)).upload(anyString(), any(byte[].class), eq("image/png"));
    }

    @Test
    void missingFileCreatesWithoutImage() throws Exception {
        assertWithoutImage(multipart(client, productJson, null, null), null);
        verifyNoInteractions(storage);
    }

    @Test
    void emptyFileCreatesWithoutImage() throws Exception {
        assertWithoutImage(multipart(client, productJson, new byte[0], "image/png"), null);
        verifyNoInteractions(storage);
    }

    @Test
    void invalidFileCreatesWithoutImageAndReturnsWarning() throws Exception {
        assertWithoutImage(multipart(client, productJson, "not an image".getBytes(StandardCharsets.UTF_8), "image/png"),
                "IMAGE_FILE_INVALID");
        verifyNoInteractions(storage);
    }

    @Test
    void r2FailureDoesNotPoisonProductTransaction() throws Exception {
        when(storage.upload(anyString(), any(), anyString()))
                .thenThrow(new BusinessException(ErrorCode.IMAGE_STORAGE_FAILED));
        assertWithoutImage(multipart(client, productJson, png(), "image/png"), "IMAGE_STORAGE_FAILED");
        assertThat(images.findAll()).noneMatch(image -> image.getUploaderMemberId().equals(operator.getId()));
    }

    @Test
    void unsupportedFileTypeCreatesWithoutImageAndReturnsWarning() throws Exception {
        assertWithoutImage(multipart(client, productJson, "<svg/>".getBytes(StandardCharsets.UTF_8), "image/svg+xml"),
                "IMAGE_TYPE_NOT_SUPPORTED");
        verifyNoInteractions(storage);
    }

    @Test
    void invalidProductIsRejectedBeforeUpload() throws Exception {
        long count = products.count();
        var response = multipart(client, productJson.replace("1000", "0"), png(), "image/png");
        assertThat(response.statusCode()).isEqualTo(400);
        assertThat(products.count()).isEqualTo(count);
        verifyNoInteractions(storage);
    }

    @Test
    void anonymousAndMemberWithoutPermissionCannotCreate() throws Exception {
        long count = products.count();
        assertThat(multipart(HttpClient.newHttpClient(), productJson, png(), "image/png").statusCode()).isEqualTo(401);
        assertThat(multipart(login(member("MEMBER")), productJson, png(), "image/png").statusCode()).isEqualTo(403);
        assertThat(products.count()).isEqualTo(count);
        verifyNoInteractions(storage);
    }

    @Test
    void oversizedRequestIsRejectedByServletBeforeProductCreation() throws Exception {
        long count = products.count();
        assertThat(multipart(client, productJson, new byte[5 * 1024 * 1024 + 1], "image/png").statusCode()).isEqualTo(413);
        assertThat(products.count()).isEqualTo(count);
        verifyNoInteractions(storage);
    }

    @Test
    void legacyJsonStillCreatesWithoutImage() throws Exception {
        var response = send(client, "POST", "/api/products", productJson);
        assertThat(response.statusCode()).isEqualTo(201);
        var body = json.readTree(response.body());
        remember(body);
        assertThat(body.get("imageUrl").isNull()).isTrue();
        assertThat(body.get("name").asText()).isEqualTo("상품 이미지 테스트");
        verifyNoInteractions(storage);
    }

    void assertWithoutImage(HttpResponse<String> response, String warning) {
        assertThat(response.statusCode()).isEqualTo(201);
        var body = json.readTree(response.body());
        var product = body.get("product");
        long id = remember(product);
        assertThat(products.existsById(id)).isTrue();
        assertThat(product.get("imageUrl").isNull()).isTrue();
        if (warning == null) assertThat(body.get("imageUploadError").isNull()).isTrue();
        else assertThat(body.get("imageUploadError").asText()).isEqualTo(warning);
    }

    long remember(JsonNode product) {
        long id = product.get("id").asLong();
        productIds.add(id);
        return id;
    }

    @Test
    void multipartUpdateAddsImageToProductWithoutImage() throws Exception {
        long id = remember(json.readTree(send(client, "POST", "/api/products", productJson).body()));
        var response = updateMultipart(client, id, png(), "image/png");
        assertThat(response.statusCode()).isEqualTo(200);
        var body = json.readTree(response.body());
        assertThat(body.get("name").asText()).isEqualTo("수정 상품");
        assertThat(body.get("imageUrl").asText()).startsWith("https://images.example.test/");
        assertThat(json.readTree(send(client, "GET", "/api/products/" + id, "").body())
                .get("imageUrl").asText()).isEqualTo(body.get("imageUrl").asText());
    }

    @Test
    void multipartUpdateReplacesImageAndKeepsOldUploadHistory() throws Exception {
        var original = createImageProduct();
        long id = original.get("id").asLong();
        String oldUrl = original.get("imageUrl").asText();
        var response = updateMultipart(client, id, png(), "image/png");
        assertThat(response.statusCode()).isEqualTo(200);
        String newUrl = json.readTree(response.body()).get("imageUrl").asText();
        assertThat(newUrl).isNotEqualTo(oldUrl);
        assertThat(images.existsById(oldUrl.substring("https://images.example.test/".length()))).isTrue();
        var list = json.readTree(send(client, "GET", "/api/products", "").body());
        for (var item : list) {
            if (item.get("id").asLong() == id) assertThat(item.get("imageUrl").asText()).isEqualTo(newUrl);
        }
        verify(storage, times(2)).upload(anyString(), any(), eq("image/png"));
    }

    @Test
    void multipartUpdateWithoutFileOrWithEmptyFileKeepsImage() throws Exception {
        var original = createImageProduct();
        long id = original.get("id").asLong();
        for (byte[] file : new byte[][] { null, new byte[0] }) {
            var response = updateMultipart(client, id, file, "image/png");
            assertThat(response.statusCode()).isEqualTo(200);
            assertThat(json.readTree(response.body()).get("imageUrl")).isEqualTo(original.get("imageUrl"));
            assertThat(json.readTree(response.body()).get("name").asText()).isEqualTo("수정 상품");
        }
        verify(storage, times(1)).upload(anyString(), any(), anyString());
    }

    @Test
    void invalidReplacementDoesNotChangeProduct() throws Exception {
        var original = createImageProduct();
        var response = updateMultipart(client, original.get("id").asLong(), new byte[] { 1, 2 }, "image/png");
        assertThat(response.statusCode()).isEqualTo(400);
        assertThat(json.readTree(response.body()).get("code").asText()).isEqualTo("IMAGE_FILE_INVALID");
        assertUnchanged(original);
        verify(storage, times(1)).upload(anyString(), any(), anyString());
    }

    @Test
    void replacementStorageFailureDoesNotChangeProduct() throws Exception {
        var original = createImageProduct();
        when(storage.upload(anyString(), any(), anyString()))
                .thenThrow(new BusinessException(ErrorCode.IMAGE_STORAGE_FAILED));
        var response = updateMultipart(client, original.get("id").asLong(), png(), "image/png");
        assertThat(response.statusCode()).isEqualTo(502);
        assertThat(json.readTree(response.body()).get("code").asText()).isEqualTo("IMAGE_STORAGE_FAILED");
        assertUnchanged(original);
        assertThat(images.findAll().stream().filter(i -> i.getUploaderMemberId().equals(operator.getId())).count())
                .isEqualTo(1);
    }

    @Test
    void unsupportedAndOversizedReplacementsKeepProduct() throws Exception {
        var original = createImageProduct();
        long id = original.get("id").asLong();
        assertThat(updateMultipart(client, id, new byte[] { 1 }, "image/svg+xml").statusCode()).isEqualTo(415);
        assertThat(updateMultipart(client, id, new byte[5 * 1024 * 1024 + 1], "image/png").statusCode()).isEqualTo(413);
        assertUnchanged(original);
        verify(storage, times(1)).upload(anyString(), any(), anyString());
    }

    @Test
    void invalidProductAndMissingProductAreRejectedBeforeReplacementUpload() throws Exception {
        var original = createImageProduct();
        long id = original.get("id").asLong();
        var invalid = multipart(client, "PUT", "/api/products/" + id,
                productJson.replace("1000", "0"), png(), "image/png");
        assertThat(invalid.statusCode()).isEqualTo(400);
        assertThat(updateMultipart(client, Long.MAX_VALUE, png(), "image/png").statusCode()).isEqualTo(404);
        assertUnchanged(original);
        verify(storage, times(1)).upload(anyString(), any(), anyString());
    }

    @Test
    void anonymousAndMemberCannotReplaceImage() throws Exception {
        var original = createImageProduct();
        long id = original.get("id").asLong();
        assertThat(updateMultipart(HttpClient.newHttpClient(), id, png(), "image/png").statusCode()).isEqualTo(401);
        assertThat(updateMultipart(login(member("MEMBER")), id, png(), "image/png").statusCode()).isEqualTo(403);
        assertUnchanged(original);
        verify(storage, times(1)).upload(anyString(), any(), anyString());
    }

    JsonNode createImageProduct() throws Exception {
        var response = multipart(client, productJson, png(), "image/png");
        assertThat(response.statusCode()).isEqualTo(201);
        var product = json.readTree(response.body()).get("product");
        remember(product);
        return product;
    }

    void assertUnchanged(JsonNode original) throws Exception {
        var current = json.readTree(send(client, "GET", "/api/products/" + original.get("id").asLong(), "").body());
        assertThat(current).isEqualTo(original);
    }

    HttpResponse<String> updateMultipart(HttpClient http, long id, byte[] file, String contentType) throws Exception {
        return multipart(http, "PUT", "/api/products/" + id,
                productJson.replace("상품 이미지 테스트", "수정 상품"), file, contentType);
    }

    Member member(String role) {
        var member = Member.pending(UUID.randomUUID() + "@example.test", encoder.encode(password),
                "Product test", Instant.now(), roles.findByCode(role).orElseThrow());
        member.activateAfterEmailVerification();
        member = members.saveAndFlush(member);
        memberIds.add(member.getId());
        return member;
    }

    HttpClient login(Member member) throws Exception {
        var http = HttpClient.newBuilder().cookieHandler(new CookieManager()).build();
        assertThat(send(http, "POST", "/api/auth/login", json.writeValueAsString(Map.of(
                "email", member.getEmail(), "password", password))).statusCode()).isEqualTo(200);
        return http;
    }

    HttpResponse<String> send(HttpClient http, String method, String path, String body) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json")
                .method(method, HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }

    HttpResponse<String> multipart(HttpClient http, String product, byte[] file, String contentType) throws Exception {
        return multipart(http, "POST", "/api/products", product, file, contentType);
    }

    HttpResponse<String> multipart(HttpClient http, String method, String path, String product, byte[] file, String contentType) throws Exception {
        String boundary = "ProductTestBoundary";
        var bytes = new ByteArrayOutputStream();
        bytes.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"product\"\r\n"
                + "Content-Type: application/json\r\n\r\n" + product).getBytes(StandardCharsets.UTF_8));
        if (file != null) {
            bytes.write(("\r\n--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"product.png\"\r\n"
                    + "Content-Type: " + contentType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            bytes.write(file);
        }
        bytes.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        return http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .method(method, HttpRequest.BodyPublishers.ofByteArray(bytes.toByteArray())).build(), HttpResponse.BodyHandlers.ofString());
    }

    byte[] png() throws Exception {
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 3, BufferedImage.TYPE_INT_RGB), "png", bytes);
        return bytes.toByteArray();
    }
}
