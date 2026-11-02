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
class MemberAddressIntegrationTest {
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

    final String base = "/api/auth/me/addresses";
    @Test void managesMultipleAddressesAndPromotesDefaultOnDeletion() throws Exception {
        var client = login(owner);
        assertThat(json.readTree(send(client, "GET", base, "").body()).size()).isZero();
        long home = create(client, "집", false);
        long work = create(client, "회사", false);
        var list = json.readTree(send(client, "GET", base, "").body());
        assertThat(list.size()).isEqualTo(2);
        assertThat(list.get(0).get("id").asLong()).isEqualTo(home);
        assertThat(list.get(0).get("defaultAddress").asBoolean()).isTrue();
        assertThat(send(client, "PATCH", base + "/" + work + "/default", "").statusCode()).isEqualTo(200);
        assertThat(deliveries.findByMemberIdAndDefaultAddressTrue(owner.getId()).orElseThrow().getId()).isEqualTo(work);
        var changed = input(" 새 회사 ", true); changed.put("recipientName", " 변경 수령인 ");
        var updated = send(client, "PUT", base + "/" + work, json.writeValueAsString(changed));
        assertThat(updated.statusCode()).as(updated.body()).isEqualTo(200);
        assertThat(json.readTree(updated.body()).get("label").asText()).isEqualTo("새 회사");
        assertThat(json.readTree(send(client, "GET", "").body()).get("recipientName").asText()).isEqualTo("변경 수령인");
        assertThat(send(client, "DELETE", base + "/" + work, "").statusCode()).isEqualTo(204);
        assertThat(deliveries.findByMemberIdAndDefaultAddressTrue(owner.getId()).orElseThrow().getId()).isEqualTo(home);
        assertThat(send(client, "DELETE", base + "/" + home, "").statusCode()).isEqualTo(204);
        assertThat(send(client, "GET", "").statusCode()).isEqualTo(204);
    }
    @Test void isolatesOwnersAndRejectsAnonymousAndInvalidRequests() throws Exception {
        var client = login(owner);
        long id = create(client, "집", false);
        var other = login(member());
        assertThat(json.readTree(send(other, "GET", base, "").body()).size()).isZero();
        for (var method : List.of("PUT", "PATCH", "DELETE")) {
            String path = base + "/" + id + (method.equals("PATCH") ? "/default" : "");
            assertThat(send(other, method, path, method.equals("PUT") ? json.writeValueAsString(input("침입", true)) : "").statusCode()).isEqualTo(404);
        }
        var anonymous = HttpClient.newHttpClient();
        assertThat(send(anonymous, "GET", base, "").statusCode()).isEqualTo(401);
        assertThat(send(anonymous, "POST", base, json.writeValueAsString(input("집", false))).statusCode()).isEqualTo(401);
        for (var field : List.of("label", "recipientName", "phone", "postalCode", "address")) {
            var invalid = input("집", false); invalid.put(field, " ");
            assertThat(send(client, "POST", base, json.writeValueAsString(invalid)).statusCode()).isEqualTo(400);
        }
        assertThat(deliveries.findByMemberIdOrderByDefaultAddressDescIdAsc(owner.getId())).hasSize(1);
    }
    @Test void concurrentCreatesAndDefaultSwitchesKeepExactlyOneDefault() throws Exception {
        var first = login(owner); var second = login(owner);
        try (var executor = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var gate = new java.util.concurrent.CountDownLatch(1);
            var a = executor.submit(() -> { gate.await(); return create(first, "집", true); });
            var b = executor.submit(() -> { gate.await(); return create(second, "회사", true); });
            gate.countDown();
            long home = a.get(), work = b.get();
            var nextGate = new java.util.concurrent.CountDownLatch(1);
            var x = executor.submit(() -> { nextGate.await(); return send(first, "PATCH", base + "/" + home + "/default", ""); });
            var y = executor.submit(() -> { nextGate.await(); return send(second, "PATCH", base + "/" + work + "/default", ""); });
            nextGate.countDown();
            assertThat(x.get().statusCode()).isEqualTo(200);
            assertThat(y.get().statusCode()).isEqualTo(200);
        }
        var list = deliveries.findByMemberIdOrderByDefaultAddressDescIdAsc(owner.getId());
        assertThat(list).hasSize(2);
        assertThat(list.stream().filter(value -> value.isDefaultAddress()).count()).isEqualTo(1);
    }
    @Test void compatibilityApiUpdatesCurrentDefaultWithoutCreatingAnotherAddress() throws Exception {
        var client = login(owner);
        long home = create(client, "집", false);
        create(client, "회사", false);
        assertThat(send(client, "PUT", json.writeValueAsString(delivery("새 수령인"))).statusCode()).isEqualTo(200);
        var list = deliveries.findByMemberIdOrderByDefaultAddressDescIdAsc(owner.getId());
        assertThat(list).hasSize(2);
        assertThat(list.getFirst().getId()).isEqualTo(home);
        assertThat(list.getFirst().getLabel()).isEqualTo("집");
        assertThat(list.getFirst().getRecipientName()).isEqualTo("새 수령인");
    }
    long create(HttpClient client, String label, boolean primary) throws Exception {
        var response = send(client, "POST", base, json.writeValueAsString(input(label, primary)));
        assertThat(response.statusCode()).as(response.body()).isEqualTo(201);
        return json.readTree(response.body()).get("id").asLong();
    }
    Map<String, Object> input(String label, boolean primary) {
        var value = new HashMap<String, Object>(delivery("수령인"));
        value.put("label", label); value.put("defaultAddress", primary); return value;
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
        return send(client, method, "/api/auth/me/default-delivery", body);
    }
    HttpResponse<String> send(HttpClient client, String method, String path, String body) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json").method(method, HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
    }
}
