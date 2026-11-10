package com.bulkup.raptor.delivery.api;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.infrastructure.session.MemberSessionDetails;
import com.bulkup.raptor.auth.infrastructure.session.RoleState;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.*;
import com.bulkup.raptor.delivery.application.service.*;
import com.bulkup.raptor.delivery.domain.*;
import com.bulkup.raptor.delivery.repository.*;
import com.bulkup.raptor.order.domain.Order;
import com.bulkup.raptor.order.repository.OrderRepository;
import com.bulkup.raptor.product.domain.*;
import com.bulkup.raptor.product.repository.ProductRepository;
import com.bulkup.raptor.role.repository.RoleRepository;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import javax.sql.DataSource;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest(properties = "app.stock.reservation.expiry.enabled=false")
class DeliveryApiIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired TransactionTemplate tx;
    @Autowired MemberRepository members;
    @Autowired RoleRepository roles;
    @Autowired OrderRepository orders;
    @Autowired ProductRepository products;
    @Autowired DeliveryRepository deliveries;
    @Autowired DeliveryStatusHistoryRepository history;
    @Autowired DeliveryCreationService creation;
    @Autowired DeliveryService service;
    @Autowired EntityManager em;
    @Autowired DataSource dataSource;
    MockMvc mvc;
    long ownerId, strangerId, productId, paidOrderId, unpaidOrderId, deliveryId;
    String recipient;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        tx.executeWithoutResult(status -> {
            String unique = UUID.randomUUID().toString();
            recipient = "delivery-" + unique.substring(0, 12);
            var role = roles.findByCode("MEMBER").orElseThrow();
            var owner = Member.pending(unique + "@example.test", "hash", "구매자", Instant.now(), role);
            owner.activateAfterEmailVerification();
            members.saveAndFlush(owner); ownerId = owner.getId();
            var stranger = Member.pending(unique + "other@example.test", "hash", "다른회원", Instant.now(), role);
            stranger.activateAfterEmailVerification();
            members.saveAndFlush(stranger); strangerId = stranger.getId();
            var product = products.saveAndFlush(Product.create("주문 상품 스냅샷", "설명", 1000, ProductCategory.SNACK, null, "🍪"));
            productId = product.getId();
            for (boolean paid : List.of(true, false)) {
                var order = Order.create(owner, UUID.randomUUID(), "test", recipient, "01012345678", "12345", "주문 주소", "101호");
                order.addItem(product, 2); order.calculateShipping();
                if (paid) order.markPaid();
                orders.saveAndFlush(order);
                if (paid) { paidOrderId = order.getId(); deliveryId = creation.ensureForPaidOrder(paidOrderId).getId(); }
                else unpaidOrderId = order.getId();
            }
        });
    }

    @AfterEach
    void cleanup() {
        tx.executeWithoutResult(status -> {
            em.createNativeQuery("delete from order_items where order_id in (select id from orders where member_id in (:owner, :other))")
                    .setParameter("owner", ownerId).setParameter("other", strangerId).executeUpdate();
            em.createNativeQuery("delete from orders where member_id in (:owner, :other)")
                    .setParameter("owner", ownerId).setParameter("other", strangerId).executeUpdate();
            products.deleteById(productId);
            members.deleteAllById(List.of(ownerId, strangerId));
        });
    }

    RequestPostProcessor auth(long memberId, String... authorities) {
        return tx.execute(status -> {
            var member = members.findById(memberId).orElseThrow();
            var states = new HashMap<Long, RoleState>();
            member.getRoles().forEach(role -> states.put(role.getId(), new RoleState(role.getCode(), role.getPermissionVersion())));
            var token = new UsernamePasswordAuthenticationToken(memberId, null,
                    Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList());
            token.setDetails(new MemberSessionDetails(member.getSessionVersion(), states));
            return authentication(token);
        });
    }

    String change(String status, long version) {
        return "{\"status\":\"" + status + "\",\"expectedVersion\":" + version + ",\"reason\":\"내부 전달 메모\"}";
    }
    String statusPath() { return "/api/admin/deliveries/" + deliveryId + "/status"; }

    @Test
    void createsOnlyPaidOrdersAndKeepsRecipientSnapshotAndOneDelivery() {
        assertThat(tx.<Long>execute(status -> creation.ensureForPaidOrder(paidOrderId).getId())).isEqualTo(deliveryId);
        assertThatThrownBy(() -> tx.execute(status -> creation.ensureForPaidOrder(unpaidOrderId)))
                .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.DELIVERY_ORDER_NOT_PAID));
        tx.executeWithoutResult(status -> em.createNativeQuery("update orders set recipient_name='새 수령인', address='새 주소' where id=:id")
                .setParameter("id", paidOrderId).executeUpdate());
        var info = service.get(deliveryId).delivery();
        assertThat(info.recipientName()).isEqualTo(recipient);
        assertThat(info.address()).isEqualTo("주문 주소");
        assertThat(info.status()).isEqualTo(DeliveryStatus.PREPARING);
        assertThat(info.centerName()).isNull();
        assertThat(info.scheduledAt()).isNull();
        assertThat(info.items().getFirst().productName()).isEqualTo("주문 상품 스냅샷");
    }

    @Test
    void createsOneDeliveryUnderConcurrentRetries() throws Exception {
        tx.executeWithoutResult(status -> deliveries.deleteById(deliveryId));
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(6)) {
            var futures = new ArrayList<Future<Long>>();
            for (int i = 0; i < 6; i++) futures.add(executor.submit(() -> {
                start.await(); return tx.execute(status -> creation.ensureForPaidOrder(paidOrderId).getId());
            }));
            start.countDown();
            var ids = new HashSet<Long>();
            for (var f : futures) ids.add(f.get(20, TimeUnit.SECONDS));
            assertThat(ids).hasSize(1);
        }
    }

    @Test
    void creationAndStatusHistoryRollBackWithTheirTransaction() {
        assertThatThrownBy(() -> tx.execute(status -> {
            var order = orders.findByIdForUpdate(unpaidOrderId).orElseThrow();
            order.markPaid(); creation.ensureForPaidOrder(unpaidOrderId);
            throw new IllegalStateException("force rollback");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(deliveries.findByOrderId(unpaidOrderId)).isEmpty();
        assertThat(orders.findById(unpaidOrderId).orElseThrow().getStatus()).isEqualTo("CREATED");
        assertThatThrownBy(() -> tx.execute(status -> {
            service.changeStatus(ownerId, deliveryId, new ChangeDeliveryStatusRequest(DeliveryStatus.OUT_FOR_DELIVERY, 0L, "실패"));
            throw new IllegalStateException("force rollback");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(service.get(deliveryId).delivery().status()).isEqualTo(DeliveryStatus.PREPARING);
        assertThat(history.findByDeliveryIdOrderByCreatedAtAscIdAsc(deliveryId)).isEmpty();
    }

    @Test
    void transitionsAtomicallyAndReturnsPublicHistoryWithoutInternalFields() throws Exception {
        mvc.perform(patch(statusPath()).with(auth(ownerId, "SHIPPING_MANAGE")).contentType(MediaType.APPLICATION_JSON)
                .content(change("OUT_FOR_DELIVERY", 0)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.delivery.version").value(1))
                .andExpect(jsonPath("$.delivery.startedAt").isNotEmpty())
                .andExpect(jsonPath("$.history[0].actorId").value(ownerId));
        // A retry with the original version does not create another history row.
        mvc.perform(patch(statusPath()).with(auth(ownerId, "SHIPPING_MANAGE")).contentType(MediaType.APPLICATION_JSON)
                .content(change("OUT_FOR_DELIVERY", 0))).andExpect(status().isOk()).andExpect(jsonPath("$.history.length()").value(1));
        mvc.perform(patch(statusPath()).with(auth(ownerId, "SHIPPING_MANAGE")).contentType(MediaType.APPLICATION_JSON)
                .content(change("DELIVERED", 1))).andExpect(status().isOk())
                .andExpect(jsonPath("$.delivery.version").value(2)).andExpect(jsonPath("$.delivery.deliveredAt").isNotEmpty())
                .andExpect(jsonPath("$.history[1].fromStatus").value("OUT_FOR_DELIVERY"));
        mvc.perform(get("/api/orders/" + paidOrderId + "/delivery").with(auth(ownerId)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.history.length()").value(2))
                .andExpect(jsonPath("$.history[0].actorId").doesNotExist())
                .andExpect(jsonPath("$.history[0].reason").doesNotExist());
        mvc.perform(get("/api/orders/" + paidOrderId + "/delivery").with(auth(strangerId)))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ORDER_NOT_FOUND"));
        mvc.perform(get("/api/orders/" + unpaidOrderId + "/delivery").with(auth(ownerId)))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("DELIVERY_NOT_FOUND"));
    }

    @Test
    void latestSuccessfulUpdaterBecomesHandlerAndRetriesKeepOriginalHandler() {
        assertThat(service.get(deliveryId).delivery().handlerName()).isNull();
        var first = service.changeStatus(ownerId, deliveryId,
                new ChangeDeliveryStatusRequest(DeliveryStatus.OUT_FOR_DELIVERY, 0L, null));
        assertThat(first.delivery().handlerName()).isEqualTo("구매자");
        assertThat(first.history().getFirst().actorName()).isEqualTo("구매자");
        var retry = service.changeStatus(strangerId, deliveryId,
                new ChangeDeliveryStatusRequest(DeliveryStatus.OUT_FOR_DELIVERY, 0L, null));
        assertThat(retry.delivery().handlerName()).isEqualTo("구매자");
        assertThat(retry.history()).hasSize(1);
        var completed = service.changeStatus(strangerId, deliveryId,
                new ChangeDeliveryStatusRequest(DeliveryStatus.DELIVERED, 1L, null));
        assertThat(completed.delivery().handlerName()).isEqualTo("다른회원");
        assertThat(completed.history().getFirst().actorId()).isEqualTo(ownerId);
        assertThat(completed.history().getLast().actorId()).isEqualTo(strangerId);
        assertThat(service.getForOrder(ownerId, paidOrderId).delivery().handlerName()).isEqualTo("다른회원");
    }

    @Test
    void rejectsStaleVersionSkippedStagesAndInvalidInputs() throws Exception {
        mvc.perform(patch(statusPath()).with(auth(ownerId, "SHIPPING_MANAGE")).contentType(MediaType.APPLICATION_JSON)
                .content(change("DELIVERED", 0))).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DELIVERY_STATUS_CONFLICT"));
        service.changeStatus(ownerId, deliveryId, new ChangeDeliveryStatusRequest(DeliveryStatus.OUT_FOR_DELIVERY, 0L, null));
        mvc.perform(patch(statusPath()).with(auth(ownerId, "SHIPPING_MANAGE")).contentType(MediaType.APPLICATION_JSON)
                .content(change("DELIVERED", 0))).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DELIVERY_VERSION_CONFLICT"));
        for (String invalid : List.of("{}", "{\"status\":\"BAD\",\"expectedVersion\":0}",
                "{\"status\":\"DELIVERED\",\"expectedVersion\":-1}",
                "{\"status\":\"DELIVERED\",\"expectedVersion\":1,\"reason\":\"" + "x".repeat(501) + "\"}")) {
            mvc.perform(patch(statusPath()).with(auth(ownerId, "SHIPPING_MANAGE")).contentType(MediaType.APPLICATION_JSON)
                    .content(invalid)).andExpect(status().isBadRequest());
        }
        assertThat(service.get(deliveryId).history()).hasSize(1);
    }

    @Test
    void simultaneousStateChangesDoNotDuplicateHistory() throws Exception {
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(4)) {
            var futures = new ArrayList<Future<?>>();
            for (int i = 0; i < 4; i++) futures.add(executor.submit(() -> {
                start.await(); return service.changeStatus(ownerId, deliveryId,
                        new ChangeDeliveryStatusRequest(DeliveryStatus.OUT_FOR_DELIVERY, 0L, "동시 요청"));
            }));
            start.countDown();
            for (var f : futures) f.get(20, TimeUnit.SECONDS);
        }
        assertThat(service.get(deliveryId).history()).hasSize(1);
        assertThat(service.get(deliveryId).delivery().version()).isEqualTo(1);
    }

    @Test
    void listUsesSnapshotFiltersStablePagingAndValidatesParameters() throws Exception {
        mvc.perform(get("/api/admin/deliveries").param("search", recipient).param("status", "PREPARING")
                .with(auth(ownerId, "MENU_ADMIN_ACCESS")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].orderId").value(paidOrderId))
                .andExpect(jsonPath("$.content[0].items[0].quantity").value(2));
        assertThat(service.list(999, 10, recipient, null).page()).isZero();
        assertThat(service.list(0, 10, Long.toString(paidOrderId), null).totalElements()).isEqualTo(1);
        for (String term : List.of(recipient + "%", recipient + "_", recipient + "\\", "999999999999999999999")) {
            assertThat(service.list(0, 10, term, null).content()).isEmpty();
        }
        for (String query : List.of("size=101", "size=0", "page=-1", "page=abc", "status=BAD", "search=" + "x".repeat(101))) {
            mvc.perform(get("/api/admin/deliveries?" + query).with(auth(ownerId, "MENU_ADMIN_ACCESS")))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/admin/deliveries/0").with(auth(ownerId, "MENU_ADMIN_ACCESS"))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/admin/deliveries/" + Long.MAX_VALUE).with(auth(ownerId, "MENU_ADMIN_ACCESS")))
                .andExpect(status().isNotFound());
    }

    @Test
    void appliesSeparateReadAndWritePermissions() throws Exception {
        mvc.perform(get("/api/admin/deliveries")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/orders/" + paidOrderId + "/delivery")).andExpect(status().isUnauthorized());
        for (String permission : List.of("ROLE_ADMIN", "SHIPPING_MANAGE")) {
            mvc.perform(get("/api/admin/deliveries").with(auth(ownerId, permission))).andExpect(status().isForbidden());
        }
        mvc.perform(get("/api/admin/deliveries/" + deliveryId).with(auth(ownerId, "MENU_ADMIN_ACCESS")))
                .andExpect(status().isOk());
        mvc.perform(patch(statusPath()).with(auth(ownerId, "MENU_ADMIN_ACCESS")).contentType(MediaType.APPLICATION_JSON)
                .content(change("OUT_FOR_DELIVERY", 0))).andExpect(status().isForbidden());
        mvc.perform(patch(statusPath()).with(auth(ownerId, "ROLE_ADMIN")).contentType(MediaType.APPLICATION_JSON)
                .content(change("OUT_FOR_DELIVERY", 0))).andExpect(status().isForbidden());
    }

    @Test
    void migrationBackfillsOnlyPaidOrdersAndPreservesSnapshots() throws Exception {
        // Re-run the actual migration in a disposable schema with pre-existing paid/unpaid orders.
        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                String schema = "delivery_migration_" + UUID.randomUUID().toString().replace("-", "");
                try (var statement = connection.createStatement()) {
                    statement.execute("create schema " + schema);
                    statement.execute("set local search_path to " + schema + ", public");
                    statement.execute("create table orders (like public.orders including all)");
                    statement.execute("insert into orders select * from public.orders where id in (" + paidOrderId + "," + unpaidOrderId + ")");
                }
                ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V21__deliveries.sql"));
                try (var statement = connection.createStatement(); var rows = statement.executeQuery("select order_id, recipient_name, center_name, scheduled_at from deliveries")) {
                    assertThat(rows.next()).isTrue();
                    assertThat(rows.getLong(1)).isEqualTo(paidOrderId);
                    assertThat(rows.getString(2)).isEqualTo(recipient);
                    assertThat(rows.getString(3)).isNull();
                    assertThat(rows.getTimestamp(4)).isNull();
                    assertThat(rows.next()).isFalse();
                }
            } finally { connection.rollback(); }
        }
    }
}
