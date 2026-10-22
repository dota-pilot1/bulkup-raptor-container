package com.bulkup.raptor.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bulkup.raptor.auth.application.service.ChangeMemberRoleService;
import com.bulkup.raptor.auth.domain.EmailVerification;
import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.domain.MemberStatus;
import com.bulkup.raptor.auth.repository.EmailVerificationRepository;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.role.repository.RoleRepository;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;

import tools.jackson.databind.json.JsonMapper;

import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class MemberRoleIntegrationTest {
    @LocalServerPort int port;
    @Autowired MemberRepository members;
    @Autowired RoleRepository roleRepository;
    @Autowired EmailVerificationRepository verifications;
    @Autowired ChangeMemberRoleService roles;
    @Autowired TransactionTemplate transactions;
    @Autowired PasswordEncoder encoder;
    private final JsonMapper json = JsonMapper.builder().build();
    private final List<Long> memberIds = new ArrayList<>();
    private final List<Long> verificationIds = new ArrayList<>();
    @Autowired com.bulkup.raptor.permission.repository.PermissionRepository permissionRepository;
    @Autowired com.bulkup.raptor.role.repository.RolePermissionRepository roleLinks;
    private final List<Long> roleIds = new ArrayList<>();
    private final List<Long> permissionIds = new ArrayList<>();

    @Autowired
    com.bulkup.raptor.permission.repository.PermissionCategoryRepository categoryRepository;

    private final List<Long> categoryIds = new ArrayList<>();
    private Member admin;
    private Member operator;
    private Member member;
    private final String password = "RoleTest123";

    @BeforeEach
    void createFixtures() {
        admin = createMember("ADMIN");
        operator = createMember("OPERATOR");
        member = createMember("MEMBER");
    }

    @AfterEach
    void cleanup() {
        verifications.deleteAllById(verificationIds);
        members.deleteAllById(memberIds);
        transactions.executeWithoutResult(
                tx -> {
                    for (Long id : roleIds) roleLinks.deleteLinks(id);
                });
        roleRepository.deleteAllById(roleIds);
        permissionRepository.deleteAllById(permissionIds);
        categoryRepository.deleteAllById(categoryIds);
    }

    Member createMember(String role) {
        Member m =
                Member.pending(
                        UUID.randomUUID() + "@example.test",
                        encoder.encode(password),
                        "Role test",
                        Instant.now(),
                        roleRepository.findByCode(role).orElseThrow());
        m.activateAfterEmailVerification();
        m = members.saveAndFlush(m);
        memberIds.add(m.getId());
        return m;
    }

    HttpClient client() {
        return HttpClient.newBuilder().cookieHandler(new CookieManager()).build();
    }

    HttpResponse<String> request(HttpClient client, String method, String path, String body)
            throws Exception {
        return client.send(
                HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                        .timeout(Duration.ofSeconds(10))
                        .header("Content-Type", "application/json")
                        .method(
                                method,
                                body == null
                                        ? HttpRequest.BodyPublishers.noBody()
                                        : HttpRequest.BodyPublishers.ofString(body))
                        .build(),
                HttpResponse.BodyHandlers.ofString());
    }

    HttpClient login(Member m) throws Exception {
        HttpClient client = client();
        var result =
                request(
                        client,
                        "POST",
                        "/api/auth/login",
                        json.writeValueAsString(
                                java.util.Map.of("email", m.getEmail(), "password", password)));
        assertThat(result.statusCode()).isEqualTo(200);
        assertThat(result.body())
                .contains("\"code\":\"" + m.getRoles().iterator().next().getCode() + "\"");
        return client;
    }

    HttpResponse<String> change(HttpClient client, Member target, String role) throws Exception {
        return request(
                client,
                "PATCH",
                "/api/admin/members/" + target.getId() + "/role",
                "{\"roleId\":"
                        + roleRepository
                                .findByCode(role)
                                .map(r -> r.getId().toString())
                                .orElse("\"ROOT\"")
                        + "}");
    }

    @Test
    void onlyAdminCanChangeRolesAndMenuAccessControlsMemberReads() throws Exception {
        assertThat(change(client(), member, "ADMIN").statusCode()).isEqualTo(401);
        for (Member denied : List.of(member, operator)) {
            var client = login(denied);
            assertThat(change(client, member, "ADMIN").statusCode()).isEqualTo(403);
            assertThat(request(client, "GET", "/api/admin/members", null).statusCode())
                    .isEqualTo(denied.hasRole("OPERATOR") ? 200 : 403);
        }
        var client = login(admin);
        assertThat(request(client, "GET", "/api/admin/members", null).body())
                .contains("\"roles\":");
        assertThat(change(client, member, "OPERATOR").statusCode()).isEqualTo(200);
        assertThat(
                        members.findById(member.getId())
                                .orElseThrow()
                                .getRoles()
                                .iterator()
                                .next()
                                .getCode())
                .isEqualTo("OPERATOR");
    }

    @Test
    void operatorCanWriteProductsButCannotAccessMemberManagement() throws Exception {
        String product =
                "{\"name\":\"Role"
                    + " test\",\"description\":\"Test\",\"price\":1000,\"category\":\"SUPPLEMENT\",\"visual\":\"X\"}";
        assertThat(request(login(member), "POST", "/api/products", product).statusCode())
                .isEqualTo(403);
        var operatorClient = login(operator);
        var created = request(operatorClient, "POST", "/api/products", product);
        assertThat(created.statusCode()).isEqualTo(201);
        long productId = json.readTree(created.body()).get("id").asLong();
        try {
            assertThat(
                            request(operatorClient, "PUT", "/api/products/" + productId, product)
                                    .statusCode())
                    .isEqualTo(200);
            assertThat(
                            request(
                                            operatorClient,
                                            "PATCH",
                                            "/api/admin/members/" + member.getId() + "/status",
                                            "{\"status\":\"SUSPENDED\"}")
                                    .statusCode())
                    .isEqualTo(403);
        } finally {
            assertThat(
                            request(operatorClient, "DELETE", "/api/products/" + productId, null)
                                    .statusCode())
                    .isEqualTo(204);
        }
    }

    @Test
    void operationRoutesAreSeparatedFromOtherAdminRoutes() throws Exception {
        for (String route : List.of("/api/admin/orders", "/api/admin/shipments")) {
            assertThat(request(login(member), "GET", route, null).statusCode()).isEqualTo(403);
            // 아직 구현되지 않은 업무 API는 권한 검사를 통과한 뒤 404를 반환한다.
            assertThat(request(login(operator), "GET", route, null).statusCode()).isEqualTo(404);
        }
        assertThat(request(login(operator), "GET", "/api/admin/unknown", null).statusCode())
                .isEqualTo(403);
    }

    @Test
    void roleChangeRevokesEveryExistingSessionAndNewLoginUsesNewRole() throws Exception {
        var first = login(operator);
        var second = login(operator);
        assertThat(change(login(admin), operator, "MEMBER").statusCode()).isEqualTo(200);
        assertThat(request(first, "GET", "/api/auth/me", null).statusCode()).isEqualTo(401);
        assertThat(request(second, "POST", "/api/products", "{}").statusCode()).isEqualTo(401);
        operator = members.findById(operator.getId()).orElseThrow();
        assertThat(request(login(operator), "GET", "/api/auth/me", null).body())
                .contains("\"code\":\"MEMBER\"");
    }

    @Test
    void returningToOldRoleDoesNotRestoreAnOldSession() throws Exception {
        var oldSession = login(operator);
        var adminClient = login(admin);
        assertThat(change(adminClient, operator, "MEMBER").statusCode()).isEqualTo(200);
        assertThat(change(adminClient, operator, "OPERATOR").statusCode()).isEqualTo(200);
        assertThat(request(oldSession, "GET", "/api/auth/me", null).statusCode()).isEqualTo(401);
    }

    @Test
    void sameRoleIsIdempotentAndRollbackDoesNotLogOutMember() throws Exception {
        var operatorClient = login(operator);
        assertThat(change(login(admin), operator, "OPERATOR").statusCode()).isEqualTo(200);
        assertThat(request(operatorClient, "GET", "/api/auth/me", null).statusCode())
                .isEqualTo(200);
        long version = members.findById(operator.getId()).orElseThrow().getSessionVersion();
        transactions.executeWithoutResult(
                status -> {
                    roles.changeRole(
                            admin.getId(),
                            operator.getId(),
                            roleRepository.findByCode("MEMBER").orElseThrow().getId());
                    status.setRollbackOnly();
                });
        assertThat(members.findById(operator.getId()).orElseThrow().getSessionVersion())
                .isEqualTo(version);
        assertThat(request(operatorClient, "GET", "/api/auth/me", null).statusCode())
                .isEqualTo(200);
    }

    @Test
    void invalidRequestsAndSelfDemotionDoNotChangeRole() throws Exception {
        var client = login(admin);
        assertThat(change(client, admin, "MEMBER").statusCode()).isEqualTo(409);
        assertThat(change(client, admin, "OPERATOR").statusCode()).isEqualTo(409);
        assertThat(change(client, admin, "ADMIN").statusCode()).isEqualTo(200);
        assertThat(change(client, member, "ROOT").statusCode()).isEqualTo(400);
        assertThat(
                        request(
                                        client,
                                        "PATCH",
                                        "/api/admin/members/" + member.getId() + "/role",
                                        "{}")
                                .statusCode())
                .isEqualTo(400);
        assertThat(
                        request(
                                        client,
                                        "PATCH",
                                        "/api/admin/members/99999999/role",
                                        "{\"roleId\":1}")
                                .statusCode())
                .isEqualTo(404);
        assertThat(
                        members.findById(admin.getId())
                                .orElseThrow()
                                .getRoles()
                                .iterator()
                                .next()
                                .getCode())
                .isEqualTo("ADMIN");
        assertThatThrownBy(
                        () ->
                                roles.changeRole(
                                        operator.getId(),
                                        member.getId(),
                                        roleRepository.findByCode("ADMIN").orElseThrow().getId()))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.ADMIN_REQUIRED);
    }

    @Test
    void concurrentCrossDemotionsKeepAnAdminAndRejectStaleAuthority() throws Exception {
        Member otherAdmin = createMember("ADMIN");
        var a = login(admin);
        var b = login(otherAdmin);
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try (var pool = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
            var first =
                    pool.submit(
                            () -> {
                                ready.countDown();
                                start.await();
                                return change(a, otherAdmin, "MEMBER").statusCode();
                            });
            var second =
                    pool.submit(
                            () -> {
                                ready.countDown();
                                start.await();
                                return change(b, admin, "OPERATOR").statusCode();
                            });
            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            var results =
                    List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS));
            assertThat(results.stream().filter(code -> code == 200).count()).isEqualTo(1);
            assertThat(results).allMatch(code -> code == 200 || code == 401 || code == 403);
        }
        var surviving =
                List.of(
                        members.findById(admin.getId()).orElseThrow(),
                        members.findById(otherAdmin.getId()).orElseThrow());
        assertThat(
                        surviving.stream()
                                .filter(
                                        m ->
                                                m.getRoles()
                                                        .iterator()
                                                        .next()
                                                        .getCode()
                                                        .equals("ADMIN"))
                                .count())
                .isEqualTo(1);
    }

    @Test
    void suspendedSessionsStayInvalidAfterReactivation() throws Exception {
        var old = login(operator);
        transactions.executeWithoutResult(
                tx ->
                        members.findByIdForUpdate(operator.getId())
                                .orElseThrow()
                                .updateStatus(MemberStatus.SUSPENDED));
        assertThat(request(old, "GET", "/api/auth/me", null).statusCode()).isEqualTo(401);
        var denied =
                request(
                        client(),
                        "POST",
                        "/api/auth/login",
                        json.writeValueAsString(
                                java.util.Map.of(
                                        "email", operator.getEmail(), "password", password)));
        assertThat(denied.statusCode()).isEqualTo(403);
        transactions.executeWithoutResult(
                tx ->
                        members.findByIdForUpdate(operator.getId())
                                .orElseThrow()
                                .updateStatus(MemberStatus.ACTIVE));
        assertThat(request(old, "GET", "/api/auth/me", null).statusCode()).isEqualTo(401);
    }

    @Test
    void signupCannotAssignPrivilegedRoleFromRequest() throws Exception {
        String email = UUID.randomUUID() + "@example.test";
        String token = UUID.randomUUID().toString();
        var verification =
                EmailVerification.issue(
                        email,
                        encoder.encode("123456"),
                        encoder.encode(token),
                        Instant.now().plusSeconds(300));
        verification.confirmCode("123456", encoder, Instant.now());
        verification = verifications.saveAndFlush(verification);
        verificationIds.add(verification.getId());
        var payload = new java.util.HashMap<String, Object>();
        payload.put("email", email);
        payload.put("password", password);
        payload.put("passwordConfirm", password);
        payload.put("name", "Signup test");
        payload.put("termsAgreed", true);
        payload.put("privacyAgreed", true);
        payload.put("emailVerificationToken", token);
        payload.put("role", "ADMIN");
        var result =
                request(client(), "POST", "/api/auth/signup", json.writeValueAsString(payload));
        var registered = members.findByEmail(email);
        registered.ifPresent(m -> memberIds.add(m.getId()));
        assertThat(result.statusCode()).isEqualTo(201);
        assertThat(registered.orElseThrow().getRoles().iterator().next().getCode())
                .isEqualTo("MEMBER");
    }

    String code() {
        return "TEST_" + UUID.randomUUID().toString().replace("-", "").toUpperCase();
    }

    long createPermission(HttpClient client) throws Exception {
        var result =
                request(
                        client,
                        "POST",
                        "/api/admin/permissions",
                        json.writeValueAsString(
                                java.util.Map.of(
                                        "code",
                                        code(),
                                        "name",
                                        "Custom permission",
                                        "description",
                                        "Test")));
        assertThat(result.statusCode()).isEqualTo(201);
        long id = json.readTree(result.body()).get("id").asLong();
        permissionIds.add(id);
        return id;
    }

    long createRole(HttpClient client, List<Long> ids) throws Exception {
        var result =
                request(
                        client,
                        "POST",
                        "/api/admin/roles",
                        json.writeValueAsString(
                                java.util.Map.of(
                                        "code",
                                        code(),
                                        "name",
                                        "Custom role",
                                        "description",
                                        "Test",
                                        "permissionIds",
                                        ids)));
        assertThat(result.statusCode()).isEqualTo(201);
        long id = json.readTree(result.body()).get("id").asLong();
        roleIds.add(id);
        return id;
    }

    HttpResponse<String> setPermissions(HttpClient client, long roleId, List<Long> ids)
            throws Exception {
        return request(
                client,
                "PUT",
                "/api/admin/roles/" + roleId + "/permissions",
                json.writeValueAsString(java.util.Map.of("permissionIds", ids)));
    }

    long createCategory(HttpClient client, String code, String name, int order) throws Exception {
        var response =
                request(
                        client,
                        "POST",
                        "/api/admin/permission-categories",
                        json.writeValueAsString(
                                java.util.Map.of(
                                        "code",
                                        code,
                                        "name",
                                        name,
                                        "description",
                                        "Test",
                                        "sortOrder",
                                        order)));
        assertThat(response.statusCode()).isEqualTo(201);
        long id = json.readTree(response.body()).get("id").asLong();
        categoryIds.add(id);
        return id;
    }

    @Test
    void categoriesAreMigratedAndCrudProtectsAssignedPermissionsWithoutChangingSessions()
            throws Exception {
        var client = login(admin);
        long id = createCategory(client, code(), "Test category", 5);
        long second = createCategory(client, code(), "Second category", 6);
        var listing = request(client, "GET", "/api/admin/permission-categories", null);
        assertThat(listing.statusCode()).isEqualTo(200);
        assertThat(json.readTree(listing.body()).get(0).get("code").asText()).isEqualTo("MENU_ACCESS");
        assertThat(json.readTree(listing.body()).get(1).get("id").asLong()).isEqualTo(id);
        assertThat(json.readTree(listing.body()).get(2).get("id").asLong()).isEqualTo(second);
        long permissionId = createPermission(client);
        assertThat(
                        permissionRepository
                                .findById(permissionId)
                                .orElseThrow()
                                .getCategory()
                                .getCode())
                .isEqualTo("OTHER");
        assertThat(
                        request(
                                        client,
                                        "PATCH",
                                        "/api/admin/permissions/" + permissionId,
                                        "{\"name\":\"Category"
                                                + " move\",\"description\":\"Test\",\"categoryId\":"
                                                + id
                                                + "}")
                                .statusCode())
                .isEqualTo(200);
        assertThat(
                        json.readTree(
                                        request(
                                                        client,
                                                        "GET",
                                                        "/api/admin/permission-categories/" + id,
                                                        null)
                                                .body())
                                .get("permissionCount")
                                .asLong())
                .isEqualTo(1);
        assertThat(
                        request(client, "DELETE", "/api/admin/permission-categories/" + id, null)
                                .statusCode())
                .isEqualTo(409);
        assertThat(
                        request(
                                        client,
                                        "GET",
                                        "/api/admin/permissions?categoryId=" + id + "&q=Category",
                                        null)
                                .statusCode())
                .isEqualTo(200);
        assertThat(
                        json.readTree(
                                        request(
                                                        client,
                                                        "GET",
                                                        "/api/admin/permissions?categoryId="
                                                                + id
                                                                + "&q=Category",
                                                        null)
                                                .body())
                                .size())
                .isEqualTo(1);
        assertThat(
                        json.readTree(
                                        request(
                                                        client,
                                                        "GET",
                                                        "/api/admin/permissions?categoryId="
                                                                + id
                                                                + "&q=%25",
                                                        null)
                                                .body())
                                .size())
                .isZero();
        assertThat(
                        request(
                                        client,
                                        "PATCH",
                                        "/api/admin/permission-categories/" + id,
                                        "{\"name\":\"Renamed"
                                            + " category\",\"description\":\"Updated\",\"sortOrder\":60}")
                                .statusCode())
                .isEqualTo(200);
        long productId = permissionRepository.findByCode("PRODUCT_MANAGE").orElseThrow().getId();
        long originalCategoryId =
                permissionRepository.findById(productId).orElseThrow().getCategory().getId();
        var opSession = login(operator);
        long version =
                roleRepository
                        .findById(operator.getRoles().iterator().next().getId())
                        .orElseThrow()
                        .getPermissionVersion();
        try {
            assertThat(
                            request(
                                            client,
                                            "PATCH",
                                            "/api/admin/permissions/" + productId,
                                            "{\"name\":\"상품"
                                                    + " 관리\",\"description\":\"\",\"categoryId\":"
                                                    + id
                                                    + "}")
                                    .statusCode())
                    .isEqualTo(200);
            assertThat(request(opSession, "GET", "/api/auth/me", null).statusCode()).isEqualTo(200);
            assertThat(request(opSession, "POST", "/api/products", "{}").statusCode())
                    .isEqualTo(400);
            assertThat(
                            roleRepository
                                    .findById(operator.getRoles().iterator().next().getId())
                                    .orElseThrow()
                                    .getPermissionVersion())
                    .isEqualTo(version);
        } finally {
            assertThat(
                            request(
                                            client,
                                            "PATCH",
                                            "/api/admin/permissions/" + productId,
                                            "{\"name\":\"상품"
                                                    + " 관리\",\"description\":\"\",\"categoryId\":"
                                                    + originalCategoryId
                                                    + "}")
                                    .statusCode())
                    .isEqualTo(200);
        }
        assertThat(
                        request(
                                        client,
                                        "PATCH",
                                        "/api/admin/permissions/" + permissionId,
                                        "{\"name\":\"Category"
                                                + " move\",\"description\":\"Test\",\"categoryId\":"
                                                + second
                                                + "}")
                                .statusCode())
                .isEqualTo(200);
        assertThat(
                        request(client, "DELETE", "/api/admin/permission-categories/" + id, null)
                                .statusCode())
                .isEqualTo(204);
        categoryIds.remove(id);
        assertThat(
                        request(client, "GET", "/api/admin/permission-categories/" + id, null)
                                .statusCode())
                .isEqualTo(404);
        assertThat(permissionRepository.existsById(permissionId)).isTrue();
    }

    @Test
    void categoryValidationAndAuthorizationAreEnforced() throws Exception {
        String root = "/api/admin/permission-categories";
        assertThat(request(client(), "GET", root, null).statusCode()).isEqualTo(401);
        var adminClient = login(admin);
        long id = createCategory(adminClient, code(), "Validation", 10);
        for (Member denied : List.of(member, operator)) {
            var deniedClient = login(denied);
            assertThat(request(deniedClient, "GET", root, null).statusCode())
                    .isEqualTo(denied.hasRole("OPERATOR") ? 200 : 403);
            assertThat(request(deniedClient, "POST", root, "{}").statusCode()).isEqualTo(403);
            assertThat(request(deniedClient, "PATCH", root + "/" + id, "{}").statusCode())
                    .isEqualTo(403);
            assertThat(request(deniedClient, "DELETE", root + "/" + id, null).statusCode())
                    .isEqualTo(403);
        }
        String duplicateCode = categoryRepository.findById(id).orElseThrow().getCode();
        assertThat(
                        request(
                                        adminClient,
                                        "POST",
                                        root,
                                        "{\"code\":\""
                                                + duplicateCode
                                                + "\",\"name\":\"Duplicate\",\"sortOrder\":0}")
                                .statusCode())
                .isEqualTo(409);
        for (String body :
                List.of(
                        "{}",
                        "{\"code\":\"lower\",\"name\":\"Bad\",\"sortOrder\":0}",
                        "{\"code\":\"VALID\",\"name\":\"Bad\",\"sortOrder\":-1}"))
            assertThat(request(adminClient, "POST", root, body).statusCode()).isEqualTo(400);
        assertThat(
                        request(
                                        adminClient,
                                        "GET",
                                        "/api/admin/permissions?categoryId=999999999",
                                        null)
                                .statusCode())
                .isEqualTo(404);
        assertThat(
                        request(
                                        adminClient,
                                        "POST",
                                        "/api/admin/permissions",
                                        "{\"code\":\"TEST_UNKNOWN_CATEGORY\",\"name\":\"Bad\",\"categoryId\":999999999}")
                                .statusCode())
                .isEqualTo(404);
        long p = createPermission(adminClient);
        assertThat(
                        request(
                                        adminClient,
                                        "PATCH",
                                        "/api/admin/permissions/" + p,
                                        "{\"name\":\"Must roll back\",\"categoryId\":999999999}")
                                .statusCode())
                .isEqualTo(404);
        assertThat(permissionRepository.findById(p).orElseThrow().getName())
                .isEqualTo("Custom permission");
    }

    @Test
    void migrationCategorizesSystemPermissions() {
        for (var entry :
                java.util.Map.of(
                                "PRODUCT_MANAGE",
                                "PRODUCT",
                                "ORDER_MANAGE",
                                "ORDER_SHIPPING",
                                "SHIPPING_MANAGE",
                                "ORDER_SHIPPING",
                                "MEMBER_MANAGE",
                                "MEMBER",
                                "MEMBER_ROLE_ASSIGN",
                                "MEMBER",
                                "ROLE_MANAGE",
                                "ACCESS",
                                "PERMISSION_MANAGE",
                                "ACCESS")
                        .entrySet()) {
            var id = permissionRepository.findByCode(entry.getKey()).orElseThrow().getId();
            assertThat(permissionRepository.findById(id).orElseThrow().getCategory().getCode())
                    .isEqualTo(entry.getValue());
        }
    }

    @Test
    void customRoleAndPermissionCrudProtectsReferencesAndSystemData() throws Exception {
        var client = login(admin);
        long permissionId = createPermission(client);
        long roleId = createRole(client, List.of(permissionId));
        assertThat(request(client, "GET", "/api/admin/roles/" + roleId, null).body())
                .contains("Custom permission");
        var detail = request(client, "GET", "/api/admin/permissions/" + permissionId, null);
        assertThat(detail.statusCode()).isEqualTo(200);
        assertThat(detail.body()).contains("Custom role");
        assertThat(
                        request(
                                        client,
                                        "PATCH",
                                        "/api/admin/roles/" + roleId,
                                        "{\"name\":\"Renamed role\",\"description\":\"New"
                                                + " description\"}")
                                .statusCode())
                .isEqualTo(200);
        assertThat(
                        request(
                                        client,
                                        "PATCH",
                                        "/api/admin/permissions/" + permissionId,
                                        "{\"name\":\"Renamed permission\",\"description\":\"New"
                                                + " description\"}")
                                .statusCode())
                .isEqualTo(200);
        assertThat(
                        request(client, "DELETE", "/api/admin/permissions/" + permissionId, null)
                                .statusCode())
                .isEqualTo(409);
        assertThat(
                        request(
                                        client,
                                        "PATCH",
                                        "/api/admin/members/" + member.getId() + "/role",
                                        "{\"roleId\":" + roleId + "}")
                                .statusCode())
                .isEqualTo(200);
        assertThat(request(client, "DELETE", "/api/admin/roles/" + roleId, null).statusCode())
                .isEqualTo(409);
        assertThat(change(client, member, "MEMBER").statusCode()).isEqualTo(200);
        assertThat(request(client, "DELETE", "/api/admin/roles/" + roleId, null).statusCode())
                .isEqualTo(204);
        roleIds.remove(roleId);
        assertThat(
                        request(client, "DELETE", "/api/admin/permissions/" + permissionId, null)
                                .statusCode())
                .isEqualTo(204);
        permissionIds.remove(permissionId);
        assertThat(request(client, "GET", "/api/admin/roles/" + roleId, null).statusCode())
                .isEqualTo(404);
        assertThat(
                        request(client, "GET", "/api/admin/permissions/" + permissionId, null)
                                .statusCode())
                .isEqualTo(404);
        assertThat(
                        request(
                                        client,
                                        "DELETE",
                                        "/api/admin/roles/"
                                                + admin.getRoles().iterator().next().getId(),
                                        null)
                                .statusCode())
                .isEqualTo(409);
        long core = permissionRepository.findByCode("PRODUCT_MANAGE").orElseThrow().getId();
        assertThat(request(client, "DELETE", "/api/admin/permissions/" + core, null).statusCode())
                .isEqualTo(409);
        assertThat(
                        setPermissions(
                                        client,
                                        member.getRoles().iterator().next().getId(),
                                        List.of(core))
                                .statusCode())
                .isEqualTo(409);
    }

    @Test
    void operatorPermissionsAreEditableButCannotGrantAdministrativeOrCustomPermissions()
            throws Exception {
        var client = login(admin);
        long operatorId = operator.getRoles().iterator().next().getId();
        var original =
                roleLinks.findLinks(List.of(operatorId)).stream()
                        .map(link -> link.getPermission().getId())
                        .toList();
        long productId = permissionRepository.findByCode("PRODUCT_MANAGE").orElseThrow().getId();
        long originalVersion =
                roleRepository.findById(operatorId).orElseThrow().getPermissionVersion();
        var operatorSession = login(operator);
        var otherSession = login(operator);
        try {
            assertThat(setPermissions(client, operatorId, original).statusCode()).isEqualTo(200);
            assertThat(roleRepository.findById(operatorId).orElseThrow().getPermissionVersion())
                    .isEqualTo(originalVersion);
            assertThat(request(operatorSession, "GET", "/api/auth/me", null).statusCode())
                    .isEqualTo(200);
            for (String code :
                    List.of(
                            "MEMBER_MANAGE",
                            "MEMBER_ROLE_ASSIGN",
                            "ROLE_MANAGE",
                            "PERMISSION_MANAGE")) {
                long id = permissionRepository.findByCode(code).orElseThrow().getId();
                assertThat(setPermissions(client, operatorId, List.of(id)).statusCode())
                        .isEqualTo(403);
            }
            long customPermission = createPermission(client);
            assertThat(setPermissions(client, operatorId, List.of(customPermission)).statusCode())
                    .isEqualTo(403);
            assertThat(
                            setPermissions(
                                            client,
                                            admin.getRoles().iterator().next().getId(),
                                            List.of())
                                    .statusCode())
                    .isEqualTo(409);
            assertThat(
                            setPermissions(
                                            client,
                                            member.getRoles().iterator().next().getId(),
                                            List.of(productId))
                                    .statusCode())
                    .isEqualTo(409);
            assertThat(request(operatorSession, "POST", "/api/products", "{}").statusCode())
                    .isEqualTo(400);
            var reduced = original.stream().filter(id -> id != productId).toList();
            assertThat(setPermissions(client, operatorId, reduced).statusCode()).isEqualTo(200);
            assertThat(roleRepository.findById(operatorId).orElseThrow().getPermissionVersion())
                    .isEqualTo(originalVersion + 1);
            assertThat(request(operatorSession, "GET", "/api/auth/me", null).statusCode())
                    .isEqualTo(401);
            assertThat(request(otherSession, "POST", "/api/products", "{}").statusCode())
                    .isEqualTo(401);
            assertThat(request(login(operator), "POST", "/api/products", "{}").statusCode())
                    .isEqualTo(403);
        } finally {
            assertThat(setPermissions(client, operatorId, original).statusCode()).isEqualTo(200);
        }
        assertThat(request(login(operator), "POST", "/api/products", "{}").statusCode())
                .isEqualTo(400);
    }

    @Test
    void crudRejectsNonAdminsInvalidCodesUnknownPermissionsAndAdminPermissionGrants()
            throws Exception {
        for (Member denied : List.of(member, operator)) {
            var client = login(denied);
            for (String path : List.of("/api/admin/roles", "/api/admin/permissions")) {
                assertThat(request(client, "GET", path, null).statusCode())
                        .isEqualTo(denied.hasRole("OPERATOR") ? 200 : 403);
                assertThat(request(client, "POST", path, "{}").statusCode()).isEqualTo(403);
            }
        }
        var client = login(admin);
        assertThat(
                        request(
                                        client,
                                        "POST",
                                        "/api/admin/permissions",
                                        "{\"code\":\"ROLE_ADMIN\",\"name\":\"Bad\"}")
                                .statusCode())
                .isEqualTo(400);
        assertThat(
                        request(
                                        client,
                                        "POST",
                                        "/api/admin/permissions",
                                        "{\"code\":\"PRODUCT_MANAGE\",\"name\":\"Duplicate\"}")
                                .statusCode())
                .isEqualTo(409);
        assertThat(
                        request(
                                        client,
                                        "POST",
                                        "/api/admin/roles",
                                        "{\"code\":\"ADMIN\",\"name\":\"Duplicate\",\"permissionIds\":[]}")
                                .statusCode())
                .isEqualTo(409);
        long roleId = createRole(client, List.of());
        assertThat(setPermissions(client, roleId, List.of(99999999L)).statusCode()).isEqualTo(404);
        for (String code :
                List.of(
                        "ROLE_MANAGE",
                        "PERMISSION_MANAGE",
                        "MEMBER_ROLE_ASSIGN",
                        "MEMBER_MANAGE")) {
            long id = permissionRepository.findByCode(code).orElseThrow().getId();
            assertThat(setPermissions(client, roleId, List.of(id)).statusCode()).isEqualTo(403);
        }
        assertThat(
                        request(client, "PATCH", "/api/admin/roles/" + roleId, "{\"name\":\"   \"}")
                                .statusCode())
                .isEqualTo(400);
    }

    @Test
    void databasePermissionControlsCustomRolesAndRevokesAllSessionsOnlyOnActualChanges()
            throws Exception {
        var client = login(admin);
        long productPermission =
                permissionRepository.findByCode("PRODUCT_MANAGE").orElseThrow().getId();
        long roleId = createRole(client, List.of(productPermission));
        assertThat(
                        request(
                                        client,
                                        "PATCH",
                                        "/api/admin/members/" + member.getId() + "/role",
                                        "{\"roleId\":" + roleId + "}")
                                .statusCode())
                .isEqualTo(200);
        Member custom = members.findById(member.getId()).orElseThrow();
        var first = login(custom);
        var second = login(custom);
        // Validation 400 proves the custom role passed PRODUCT_MANAGE authorization.
        assertThat(request(first, "POST", "/api/products", "{}").statusCode()).isEqualTo(400);
        assertThat(request(first, "GET", "/api/admin/members", null).statusCode()).isEqualTo(403);
        assertThat(setPermissions(client, roleId, List.of(productPermission)).statusCode())
                .isEqualTo(200);
        assertThat(request(first, "GET", "/api/auth/me", null).statusCode()).isEqualTo(200);
        assertThat(
                        request(
                                        client,
                                        "PATCH",
                                        "/api/admin/roles/" + roleId,
                                        "{\"name\":\"Display only\",\"description\":\"\"}")
                                .statusCode())
                .isEqualTo(200);
        assertThat(request(first, "GET", "/api/auth/me", null).statusCode()).isEqualTo(200);
        assertThat(setPermissions(client, roleId, List.of()).statusCode()).isEqualTo(200);
        assertThat(request(first, "GET", "/api/auth/me", null).statusCode()).isEqualTo(401);
        assertThat(request(second, "POST", "/api/products", "{}").statusCode()).isEqualTo(401);
        assertThat(request(login(custom), "POST", "/api/products", "{}").statusCode())
                .isEqualTo(403);
        long unused = createPermission(client);
        assertThat(setPermissions(client, roleId, List.of(unused)).statusCode()).isEqualTo(200);
        assertThat(request(login(custom), "POST", "/api/products", "{}").statusCode())
                .isEqualTo(403);
    }

    @Test
    void replacingOverlappingPermissionSetsAndRollbackAreSafe() throws Exception {
        var client = login(admin);
        long one = createPermission(client);
        long two = createPermission(client);
        long roleId = createRole(client, List.of(one));
        assertThat(setPermissions(client, roleId, List.of(one, two)).statusCode()).isEqualTo(200);
        assertThat(setPermissions(client, roleId, List.of(two)).statusCode()).isEqualTo(200);
        long version = roleRepository.findById(roleId).orElseThrow().getPermissionVersion();
        transactions.executeWithoutResult(
                tx -> {
                    roleCommands.replacePermissions(admin.getId(), roleId, java.util.Set.of(one));
                    tx.setRollbackOnly();
                });
        assertThat(roleRepository.findById(roleId).orElseThrow().getPermissionVersion())
                .isEqualTo(version);
        assertThat(roleLinks.findCodes(roleId))
                .containsExactly(permissionRepository.findById(two).orElseThrow().getCode());
    }

    @Autowired com.bulkup.raptor.role.application.service.RoleCommandService roleCommands;

    @Test
    void concurrentAssignmentAndRoleDeletionCannotLeaveAnOrphan() throws Exception {
        var client = login(admin);
        var otherClient = login(createMember("ADMIN"));
        long roleId = createRole(client, List.of());
        var start = new CountDownLatch(1);
        try (var pool = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
            var assignment =
                    pool.submit(
                            () -> {
                                start.await();
                                return request(
                                                otherClient,
                                                "PATCH",
                                                "/api/admin/members/" + member.getId() + "/role",
                                                "{\"roleId\":" + roleId + "}")
                                        .statusCode();
                            });
            var deletion =
                    pool.submit(
                            () -> {
                                start.await();
                                return request(client, "DELETE", "/api/admin/roles/" + roleId, null)
                                        .statusCode();
                            });
            start.countDown();
            int assigned = assignment.get(10, TimeUnit.SECONDS);
            int deleted = deletion.get(10, TimeUnit.SECONDS);
            assertThat((assigned == 200 && deleted == 409) || (assigned == 404 && deleted == 204))
                    .isTrue();
            if (deleted == 204) roleIds.remove(roleId);
            var stored = members.findById(member.getId()).orElseThrow();
            assertThat(roleRepository.existsById(stored.getRoles().iterator().next().getId()))
                    .isTrue();
        }
    }

    HttpResponse<String> assignRoles(HttpClient client, Member target, List<Long> ids)
            throws Exception {
        return request(
                client,
                "PATCH",
                "/api/admin/members/" + target.getId() + "/roles",
                json.writeValueAsString(java.util.Map.of("roleIds", ids)));
    }

    @Test
    void multipleRolesMergePermissionsWithoutDuplicatesAndKeepPaginationStable() throws Exception {
        var client = login(admin);
        long product = permissionRepository.findByCode("PRODUCT_MANAGE").orElseThrow().getId();
        long order = permissionRepository.findByCode("ORDER_MANAGE").orElseThrow().getId();
        long first = createRole(client, List.of(product));
        long second = createRole(client, List.of(product, order));
        long memberCount = members.count();
        assertThat(assignRoles(client, member, List.of(first, second)).statusCode()).isEqualTo(200);
        Member updated = members.findById(member.getId()).orElseThrow();
        assertThat(updated.getRoles()).hasSize(2);
        var user = login(updated);
        var me = json.readTree(request(user, "GET", "/api/auth/me", null).body());
        assertThat(me.get("roles").size()).isEqualTo(2);
        assertThat(me.get("permissions").size()).isEqualTo(2);
        assertThat(me.get("permissions").toString()).contains("PRODUCT_MANAGE", "ORDER_MANAGE");
        assertThat(me.get("permissionDetails").size()).isEqualTo(2);
        assertThat(me.get("permissionDetails").get(0).get("code").asText()).isEqualTo("ORDER_MANAGE");
        assertThat(me.get("permissionDetails").get(0).get("name").asText()).isEqualTo("주문 관리");
        assertThat(me.get("permissionDetails").get(1).get("code").asText()).isEqualTo("PRODUCT_MANAGE");
        assertThat(me.get("permissionDetails").get(1).get("name").asText()).isEqualTo("상품 관리");
        assertThat(me.get("permissionDetails").get(0).get("categoryCode").asText()).isEqualTo("ORDER_SHIPPING");
        assertThat(me.get("permissionDetails").get(0).get("categoryName").asText()).isEqualTo("주문·배송");
        assertThat(me.get("permissionDetails").get(0).get("categorySortOrder").asInt()).isEqualTo(20);
        assertThat(me.get("permissionDetails").get(1).get("categoryCode").asText()).isEqualTo("PRODUCT");
        assertThat(request(user, "POST", "/api/products", "{}").statusCode()).isEqualTo(400);
        assertThat(request(user, "GET", "/api/admin/members", null).statusCode()).isEqualTo(403);
        var page =
                json.readTree(
                        request(
                                        client,
                                        "GET",
                                        "/api/admin/members?search=" + member.getEmail(),
                                        null)
                                .body());
        assertThat(page.get("totalElements").asLong()).isEqualTo(1);
        assertThat(page.get("content").size()).isEqualTo(1);
        assertThat(page.get("content").get(0).get("roles").size()).isEqualTo(2);
        assertThat(page.get("statistics").get("total").asLong()).isEqualTo(memberCount);
        assertThat(
                        json.readTree(
                                        request(client, "GET", "/api/admin/roles/" + second, null)
                                                .body())
                                .get("memberCount")
                                .asLong())
                .isEqualTo(1);
        assertThat(request(client, "DELETE", "/api/admin/roles/" + second, null).statusCode())
                .isEqualTo(409);
    }

    @Test
    void unchangedRoleSetsKeepSessionsButRemovingAnyRoleInvalidatesEverySession() throws Exception {
        var client = login(admin);
        long first = createRole(client, List.of());
        long second = createRole(client, List.of());
        assertThat(assignRoles(client, member, List.of(first, second)).statusCode()).isEqualTo(200);
        var updated = members.findById(member.getId()).orElseThrow();
        long version = updated.getSessionVersion();
        var one = login(updated);
        var two = login(updated);
        assertThat(assignRoles(client, member, List.of(second, first, first)).statusCode())
                .isEqualTo(200);
        assertThat(members.findById(member.getId()).orElseThrow().getSessionVersion())
                .isEqualTo(version);
        assertThat(request(one, "GET", "/api/auth/me", null).statusCode()).isEqualTo(200);
        assertThat(assignRoles(client, member, List.of(first)).statusCode()).isEqualTo(200);
        assertThat(request(one, "GET", "/api/auth/me", null).statusCode()).isEqualTo(401);
        assertThat(request(two, "GET", "/api/auth/me", null).statusCode()).isEqualTo(401);
        assertThat(members.findById(member.getId()).orElseThrow().getRoles())
                .extracting(r -> r.getId())
                .containsExactly(first);
    }

    @Test
    void anyAssignedRolePermissionChangeRevokesSessionButUnrelatedRolesDoNot() throws Exception {
        var client = login(admin);
        long product = permissionRepository.findByCode("PRODUCT_MANAGE").orElseThrow().getId();
        long first = createRole(client, List.of(product));
        long second = createRole(client, List.of());
        long unrelated = createRole(client, List.of());
        assertThat(assignRoles(client, member, List.of(first, second)).statusCode()).isEqualTo(200);
        var user = login(members.findById(member.getId()).orElseThrow());
        assertThat(setPermissions(client, unrelated, List.of(product)).statusCode()).isEqualTo(200);
        assertThat(request(user, "GET", "/api/auth/me", null).statusCode()).isEqualTo(200);
        // The union of permission codes stays the same, but the second role version changes.
        assertThat(setPermissions(client, second, List.of(product)).statusCode()).isEqualTo(200);
        assertThat(request(user, "GET", "/api/auth/me", null).statusCode()).isEqualTo(401);
    }

    @Test
    void multiRoleAssignmentValidatesInputAndKeepsSelfProtection() throws Exception {
        var client = login(admin);
        var user = login(member);
        long memberRole = roleRepository.findByCode("MEMBER").orElseThrow().getId();
        long adminRole = roleRepository.findByCode("ADMIN").orElseThrow().getId();
        assertThat(assignRoles(client, member, List.of()).statusCode()).isEqualTo(400);
        assertThat(assignRoles(client, member, List.of(99999999L)).statusCode()).isEqualTo(404);
        assertThat(
                        request(
                                        client,
                                        "PATCH",
                                        "/api/admin/members/" + member.getId() + "/roles",
                                        "{\"roleIds\":[null]}")
                                .statusCode())
                .isEqualTo(400);
        assertThat(assignRoles(user, member, List.of(adminRole)).statusCode()).isEqualTo(403);
        assertThat(assignRoles(client, admin, List.of(adminRole, memberRole)).statusCode())
                .isEqualTo(409);
        assertThat(request(user, "GET", "/api/auth/me", null).statusCode()).isEqualTo(200);
        // ADMIN is recognized wherever it appears in the member's role set.
        assertThat(assignRoles(client, member, List.of(memberRole, adminRole)).statusCode())
                .isEqualTo(200);
        assertThat(
                        request(
                                        login(members.findById(member.getId()).orElseThrow()),
                                        "GET",
                                        "/api/admin/members",
                                        null)
                                .statusCode())
                .isEqualTo(200);
    }

    @Test
    void rollingBackMultiRoleAssignmentKeepsMembershipAndSessions() throws Exception {
        var client = login(admin);
        long first = createRole(client, List.of());
        long second = createRole(client, List.of());
        assertThat(assignRoles(client, member, List.of(first, second)).statusCode()).isEqualTo(200);
        var current = members.findById(member.getId()).orElseThrow();
        var user = login(current);
        assertThatThrownBy(
                        () ->
                                transactions.executeWithoutResult(
                                        tx -> {
                                            roles.changeRoles(
                                                    admin.getId(),
                                                    member.getId(),
                                                    java.util.Set.of(first));
                                            throw new IllegalStateException("rollback");
                                        }))
                .isInstanceOf(IllegalStateException.class);
        assertThat(members.findById(member.getId()).orElseThrow().getRoles()).hasSize(2);
        assertThat(request(user, "GET", "/api/auth/me", null).statusCode()).isEqualTo(200);
    }

    @Test
    void oneAdminEntryPermissionReplacesAllMenuPermissions() throws Exception {
        var category = categoryRepository.findAll().stream()
                .filter(c -> c.getCode().equals("MENU_ACCESS")).findFirst().orElseThrow();
        var menuCodes = permissionRepository.findAll().stream()
                .filter(p -> p.getCode().startsWith("MENU_"))
                .map(p -> {
                    assertThat(p.getCategory().getId()).isEqualTo(category.getId());
                    return p.getCode();
                }).toList();
        assertThat(menuCodes).containsExactly("MENU_ADMIN_ACCESS");
        for (var account : List.of(admin, operator)) {
            var response = json.readTree(request(login(account), "GET", "/api/auth/me", null).body());
            assertThat(response.get("permissions").toString()).contains("MENU_ADMIN_ACCESS");
        }
        assertThat(request(login(member), "GET", "/api/auth/me", null).body()).doesNotContain("MENU_ADMIN_ACCESS");
    }

    private HttpClient loginWithAdminMenuPermission() throws Exception {
        var adminClient = login(admin);
        long permissionId = permissionRepository.findByCode("MENU_ADMIN_ACCESS").orElseThrow().getId();
        long roleId = createRole(adminClient, List.of(permissionId));
        assertThat(assignRoles(adminClient, member, List.of(roleId)).statusCode()).isEqualTo(200);
        return login(members.findById(member.getId()).orElseThrow());
    }

    @Test
    void adminEntryPermissionAllowsAllMenuReadsButNoCommands() throws Exception {
        var viewer = loginWithAdminMenuPermission();
        for (String path : List.of("/api/admin/roles", "/api/admin/permissions",
                "/api/admin/permission-categories", "/api/admin/members", "/api/products")) {
            assertThat(request(viewer, "GET", path, null).statusCode()).as(path).isEqualTo(200);
        }
        for (String path : List.of("/api/admin/roles", "/api/admin/permissions",
                "/api/admin/permission-categories", "/api/products")) {
            assertThat(request(viewer, "POST", path, "{}").statusCode()).as(path).isEqualTo(403);
        }
        assertThat(request(viewer, "PATCH", "/api/admin/members/" + operator.getId() + "/status",
                "{\"status\":\"SUSPENDED\"}").statusCode()).isEqualTo(403);
        assertThat(assignRoles(viewer, operator, List.of(roleRepository.findByCode("ADMIN").orElseThrow().getId()))
                .statusCode()).isEqualTo(403);
    }

    @Test
    void revokingAdminEntryPermissionInvalidatesExistingSession() throws Exception {
        var viewer = loginWithAdminMenuPermission();
        assertThat(request(viewer, "GET", "/api/admin/members", null).statusCode()).isEqualTo(200);
        var adminClient = login(admin);
        assertThat(request(adminClient, "PUT", "/api/admin/roles/" + roleIds.getFirst() + "/permissions",
                "{\"permissionIds\":[]}").statusCode()).isEqualTo(200);
        assertThat(request(viewer, "GET", "/api/auth/me", null).statusCode()).isEqualTo(401);
        assertThat(request(viewer, "GET", "/api/admin/members", null).statusCode()).isEqualTo(401);
    }
}
