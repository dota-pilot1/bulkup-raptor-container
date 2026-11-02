package com.bulkup.raptor.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.auth.repository.MemberAddressRepository;
import com.bulkup.raptor.role.repository.RoleRepository;
import java.net.*;
import java.net.http.*;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class DefaultDeliveryIntegrationTest {
    @LocalServerPort int port;
    @Autowired MemberRepository members;
    @Autowired MemberAddressRepository deliveries;
    @Autowired RoleRepository roles;
    @Autowired PasswordEncoder encoder;
    final JsonMapper json = JsonMapper.builder().build();
    final List<Long> ids = new ArrayList<>();
    Member owner;
    @BeforeEach void setup() { owner = member(); }
    @AfterEach void cleanup() {
        for (var id : ids) deliveries.deleteAll(deliveries.findByMemberIdOrderByDefaultAddressDescIdAsc(id));
        members.deleteAllById(ids);
    }

    @Test void savesUpdatesAndPersistsWithoutSharingOtherMembers() throws Exception {
        var client = login(owner);
        assertThat(send(client, "GET", "").statusCode()).isEqualTo(204);
        var saved = send(client, "PUT", json.writeValueAsString(delivery(" 첫 수령인 ")));
        assertThat(saved.statusCode()).as(saved.body()).isEqualTo(200);
        assertThat(json.readTree(saved.body()).get("recipientName").asText()).isEqualTo("첫 수령인");
        assertThat(json.readTree(send(login(owner), "GET", "").body()).get("address").asText()).isEqualTo("서울시 테스트로");
        assertThat(send(login(member()), "GET", "").statusCode()).isEqualTo(204);
        assertThat(send(client, "PUT", json.writeValueAsString(delivery("변경 수령인"))).statusCode()).isEqualTo(200);
        assertThat(deliveries.findByMemberIdAndDefaultAddressTrue(owner.getId()).orElseThrow().getRecipientName()).isEqualTo("변경 수령인");
    }
    @Test void rejectsAnonymousAndInvalidDataWithoutOverwritingSavedDelivery() throws Exception {
        var anonymous = HttpClient.newHttpClient();
        assertThat(send(anonymous, "GET", "").statusCode()).isEqualTo(401);
        assertThat(send(anonymous, "PUT", json.writeValueAsString(delivery("수령인"))).statusCode()).isEqualTo(401);
        var client = login(owner);
        assertThat(send(client, "PUT", json.writeValueAsString(delivery("원본"))).statusCode()).isEqualTo(200);
        for (var field : List.of("recipientName", "phone", "postalCode", "address")) {
            var invalid = delivery("변경"); invalid.put(field, " ");
            assertThat(send(client, "PUT", json.writeValueAsString(invalid)).statusCode()).isEqualTo(400);
        }
        assertThat(deliveries.findByMemberIdAndDefaultAddressTrue(owner.getId()).orElseThrow().getRecipientName()).isEqualTo("원본");
    }
    @Test void concurrentInitialSavesKeepOneDefaultDelivery() throws Exception {
        var first = login(owner); var second = login(owner);
        var request = json.writeValueAsString(delivery("동시 등록"));
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var gate = new java.util.concurrent.CountDownLatch(1);
            var a = executor.submit(() -> { gate.await(); return send(first, "PUT", request); });
            var b = executor.submit(() -> { gate.await(); return send(second, "PUT", request); });
            gate.countDown();
            assertThat(a.get().statusCode()).isEqualTo(200); assertThat(b.get().statusCode()).isEqualTo(200);
        }
        assertThat(deliveries.findByMemberIdAndDefaultAddressTrue(owner.getId())).isPresent();
    }
    Map<String, String> delivery(String name) {
        return new HashMap<>(Map.of("recipientName", name, "phone", "01012345678", "postalCode", "06236", "address", "서울시 테스트로", "addressDetail", "101호"));
    }
    Member member() {
        var member = Member.pending(UUID.randomUUID() + "@example.test", encoder.encode("DeliveryTest123"), "배송 테스트", Instant.now(), roles.findByCode("MEMBER").orElseThrow());
        member.activateAfterEmailVerification(); member = members.saveAndFlush(member); ids.add(member.getId()); return member;
    }
    HttpClient login(Member member) throws Exception {
        var client = HttpClient.newBuilder().cookieHandler(new CookieManager()).build();
        var response = client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/auth/login"))
                .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(Map.of("email", member.getEmail(), "password", "DeliveryTest123")))).build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as(response.body()).isEqualTo(200); return client;
    }
    HttpResponse<String> send(HttpClient client, String method, String body) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/auth/me/default-delivery"))
                .header("Content-Type", "application/json").method(method, HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }
}
