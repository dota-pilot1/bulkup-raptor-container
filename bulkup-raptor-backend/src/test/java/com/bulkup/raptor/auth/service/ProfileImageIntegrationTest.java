package com.bulkup.raptor.auth.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.bulkup.raptor.auth.application.service.UpdateProfileImageService;
import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.image.application.port.ImageStorage;
import com.bulkup.raptor.image.domain.UploadedImage;
import com.bulkup.raptor.image.repository.UploadedImageRepository;
import com.bulkup.raptor.role.repository.RoleRepository;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
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
class ProfileImageIntegrationTest {
    @LocalServerPort int port;
    @Autowired MemberRepository members;
    @Autowired RoleRepository roles;
    @Autowired UploadedImageRepository images;
    @Autowired UpdateProfileImageService profiles;
    @Autowired TransactionTemplate transactions;
    @Autowired PasswordEncoder encoder;
    @MockitoBean ImageStorage storage;
    final JsonMapper json = JsonMapper.builder().build();
    final List<Long> memberIds = new ArrayList<>();
    final List<String> keys = new ArrayList<>();
    Member owner;
    Member other;
    final String password = "ProfileTest123";

    @BeforeEach
    void setup() {
        owner = createMember();
        other = createMember();
        when(storage.upload(anyString(), any(byte[].class), anyString()))
                .thenAnswer(call -> "https://images.example.test/" + call.getArgument(0));
    }

    @AfterEach
    void cleanup() {
        // 회원의 프로필 FK를 먼저 해제한 뒤 테스트 이력과 회원만 삭제한다.
        transactions.executeWithoutResult(tx -> {
            for (Long id : memberIds) {
                var member = members.findById(id).orElseThrow();
                org.springframework.test.util.ReflectionTestUtils.setField(member, "profileImage", null);
            }
            members.flush();
            images.deleteAllById(keys);
            images.flush();
            members.deleteAllById(memberIds);
        });
    }

    @Test
    void uploadThenAttachReplaceAndRelogin() throws Exception {
        HttpClient client = login(owner);
        assertThat(get(client).get("profileImageUrl").isNull()).isTrue();
        String first = upload(client);
        assertThat(images.findById(first).orElseThrow().getUploaderMemberId()).isEqualTo(owner.getId());
        var attached = patch(client, first);
        assertThat(attached.statusCode()).isEqualTo(200);
        assertThat(body(attached).get("profileImageUrl").asText()).endsWith(first);
        assertThat(get(client).get("profileImageUrl").asText()).endsWith(first);
        String next = upload(client);
        assertThat(next).isNotEqualTo(first);
        assertThat(patch(client, next).statusCode()).isEqualTo(200);
        assertThat(patch(client, next).statusCode()).isEqualTo(200);
        assertThat(get(login(owner)).get("profileImageUrl").asText()).endsWith(next);
        assertThat(images.existsById(first)).isTrue();
        verify(storage, times(2)).upload(anyString(), any(byte[].class), anyString());
    }

    @Test
    void rejectsOtherOwnersAndUnknownKeysWithoutChangingCurrentProfile() throws Exception {
        var client = login(owner);
        String original = stored(owner);
        profiles.update(owner.getId(), original);
        String foreign = stored(other);
        String unknown = "images/" + UUID.randomUUID() + ".png";
        for (String key : List.of(foreign, unknown)) {
            var response = patch(client, key);
            assertThat(response.statusCode()).isEqualTo(400);
            assertThat(body(response).get("code").asText()).isEqualTo("PROFILE_IMAGE_NOT_AVAILABLE");
        }
        assertThat(get(client).get("profileImageUrl").asText()).endsWith(original);
    }

    @Test
    void rejectsAnonymousAndMalformedRequests() throws Exception {
        assertThat(patch(HttpClient.newHttpClient(), "images/" + UUID.randomUUID() + ".png").statusCode())
                .isEqualTo(401);
        var client = login(owner);
        for (String value : List.of("", "../bad.png", "https://external.test/p.png", "images/a.svg")) {
            var response = patch(client, value);
            assertThat(response.statusCode()).isEqualTo(400);
            assertThat(body(response).get("code").asText()).isEqualTo("INVALID_INPUT");
        }
        assertThat(send(client, "PATCH", "/api/auth/me/profile-image", "{}").statusCode()).isEqualTo(400);
        assertThat(send(client, "PATCH", "/api/auth/me/profile-image", "{").statusCode()).isEqualTo(400);
    }

    @Test
    void cannotSelectAnotherMemberViaRequestBody() throws Exception {
        var client = login(owner);
        String key = stored(owner);
        var result = send(client, "PATCH", "/api/auth/me/profile-image",
                "{\"key\":\"" + key + "\",\"memberId\":" + other.getId() + "}");
        // 모르는 필드를 거부하거나 무시해도 다른 회원은 바뀌지 않아야 한다.
        assertThat(result.statusCode()).isIn(200, 400);
        assertThat(get(login(other)).get("profileImageUrl").isNull()).isTrue();
    }

    @Test
    void uploadFailureDoesNotCreateHistoryOrChangeProfile() throws Exception {
        String original = stored(owner);
        profiles.update(owner.getId(), original);
        long count = images.count();
        when(storage.upload(anyString(), any(), anyString()))
                .thenThrow(new BusinessException(ErrorCode.IMAGE_STORAGE_FAILED));
        var client = login(owner);
        var response = uploadResponse(client);
        assertThat(response.statusCode()).isEqualTo(502);
        assertThat(images.count()).isEqualTo(count);
        assertThat(get(client).get("profileImageUrl").asText()).endsWith(original);
    }

    @Test
    void rollbackKeepsPreviousProfile() {
        String original = stored(owner);
        String next = stored(owner);
        profiles.update(owner.getId(), original);
        assertThatThrownBy(() -> transactions.executeWithoutResult(tx -> {
            profiles.update(owner.getId(), next);
            throw new IllegalStateException("rollback test");
        })).isInstanceOf(IllegalStateException.class);
        transactions.executeWithoutResult(tx -> assertThat(members.findById(owner.getId()).orElseThrow()
                .getProfileImageUrl()).endsWith(original));
    }

    @Test
    void concurrentUpdatesWaitForTheMemberLock() throws Exception {
        String first = stored(owner);
        String next = stored(owner);
        var locked = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var started = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var a = executor.submit(() -> transactions.executeWithoutResult(tx -> {
                profiles.update(owner.getId(), first);
                locked.countDown();
                try {
                    if (!release.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("release timed out");
                } catch (InterruptedException e) { throw new RuntimeException(e); }
            }));
            assertThat(locked.await(5, TimeUnit.SECONDS)).isTrue();
            var b = executor.submit(() -> {
                started.countDown();
                return profiles.update(owner.getId(), next);
            });
            try {
                assertThat(started.await(5, TimeUnit.SECONDS)).isTrue();
                assertThatThrownBy(() -> b.get(150, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
            } finally { release.countDown(); }
            a.get(5, TimeUnit.SECONDS);
            assertThat(b.get(5, TimeUnit.SECONDS).profileImageUrl()).endsWith(next);
        }
    }

    Member createMember() {
        var m = Member.pending(UUID.randomUUID() + "@example.test", encoder.encode(password),
                "Profile test", Instant.now(), roles.findByCode("MEMBER").orElseThrow());
        m.activateAfterEmailVerification();
        m = members.saveAndFlush(m);
        memberIds.add(m.getId());
        return m;
    }

    String stored(Member member) {
        String key = "images/" + UUID.randomUUID() + ".png";
        images.saveAndFlush(UploadedImage.stored(key, member.getId(), "https://images.example.test/" + key));
        keys.add(key);
        return key;
    }

    HttpClient login(Member m) throws Exception {
        var client = HttpClient.newBuilder().cookieHandler(new CookieManager()).build();
        var result = send(client, "POST", "/api/auth/login",
                "{\"email\":\"" + m.getEmail() + "\",\"password\":\"" + password + "\"}");
        assertThat(result.statusCode()).isEqualTo(200);
        return client;
    }

    HttpResponse<String> send(HttpClient client, String method, String path, String payload) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json")
                .method(method, HttpRequest.BodyPublishers.ofString(payload)).build(), HttpResponse.BodyHandlers.ofString());
    }

    HttpResponse<String> patch(HttpClient client, String key) throws Exception {
        return send(client, "PATCH", "/api/auth/me/profile-image", "{\"key\":\"" + key + "\"}");
    }

    JsonNode get(HttpClient client) throws Exception {
        var response = send(client, "GET", "/api/auth/me", "");
        assertThat(response.statusCode()).isEqualTo(200);
        return body(response);
    }

    JsonNode body(HttpResponse<String> response) { return json.readTree(response.body()); }

    String upload(HttpClient client) throws Exception {
        var response = uploadResponse(client);
        assertThat(response.statusCode()).isEqualTo(201);
        String key = body(response).get("key").asText();
        keys.add(key);
        return key;
    }

    HttpResponse<String> uploadResponse(HttpClient client) throws Exception {
        String boundary = "ProfileImageBoundary";
        var bytes = new ByteArrayOutputStream();
        bytes.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"p.png\"\r\n"
                + "Content-Type: image/png\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        ImageIO.write(new BufferedImage(2, 3, BufferedImage.TYPE_INT_RGB), "png", bytes);
        bytes.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/images"))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(bytes.toByteArray())).build(), HttpResponse.BodyHandlers.ofString());
    }
}
