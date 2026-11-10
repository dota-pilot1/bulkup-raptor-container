package com.bulkup.raptor.admin.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.bulkup.raptor.admin.application.service.AdminOrderQueryService;
import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.delivery.domain.Delivery;
import com.bulkup.raptor.delivery.repository.DeliveryRepository;
import com.bulkup.raptor.order.domain.Order;
import com.bulkup.raptor.order.repository.OrderRepository;
import com.bulkup.raptor.payment.domain.Payment;
import com.bulkup.raptor.payment.repository.PaymentRepository;
import com.bulkup.raptor.product.domain.Product;
import com.bulkup.raptor.product.domain.ProductCategory;
import com.bulkup.raptor.product.repository.ProductRepository;
import com.bulkup.raptor.role.repository.RoleRepository;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Transactional
class AdminOrderApiIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired MemberRepository members;
    @Autowired RoleRepository roles;
    @Autowired OrderRepository orders;
    @Autowired ProductRepository products;
    @Autowired PaymentRepository payments;
    @Autowired DeliveryRepository deliveries;
    @Autowired AdminOrderQueryService service;
    @Autowired EntityManager em;
    MockMvc mvc;
    String prefix;
    final List<Long> ids = new ArrayList<>();
    Product product;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        prefix = "admin-order-" + UUID.randomUUID().toString().substring(0, 12);
        var role = roles.findByCode("MEMBER").orElseThrow();
        var first = members.saveAndFlush(Member.pending(prefix + "1@example.test", "hash", prefix + "첫주문자", Instant.now(), role));
        var second = members.saveAndFlush(Member.pending(prefix + "2@example.test", "hash", prefix + "둘째주문자", Instant.now(), role));
        product = products.saveAndFlush(Product.create("주문 당시 상품", "설명", 1200, ProductCategory.SUPPLEMENT, null, "🥛"));
        for (int i = 0; i < 3; i++) {
            var order = Order.create(i == 2 ? second : first, UUID.randomUUID(), "test", "수령인", "01012345678", "06236", "서울", "101호");
            order.addItem(product, 2);
            order.calculateShipping();
            orders.saveAndFlush(order);
            ids.add(order.getId());
            if (i > 0) {
                var payment = Payment.ready(order);
                if (i == 2) {
                    payment.markPaid(Instant.parse("2026-11-01T03:00:00Z"), "tx", "pg", "KAKAOPAY");
                    payment.markWebhookVerified();
                    order.markPaid();
                }
                payments.saveAndFlush(payment);
                if (i == 2) deliveries.saveAndFlush(Delivery.prepare(order));
            }
            em.createNativeQuery("update orders set created_at = :at where id = :id")
                    .setParameter("at", Instant.parse("2026-11-01T00:00:00Z")).setParameter("id", order.getId()).executeUpdate();
        }
        em.clear();
    }

    @Test
    void cancelledStatusFilterIncludesOnlyCancelledOrders() throws Exception {
        orders.findByIdForUpdate(ids.getFirst()).orElseThrow().cancelUnpaid();
        orders.flush(); em.clear();
        mvc.perform(get("/api/admin/orders").param("search",prefix).param("status","CANCELLED")
                .with(user("viewer").authorities(new SimpleGrantedAuthority("MENU_ADMIN_ACCESS"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].orderId").value(ids.getFirst()))
                .andExpect(jsonPath("$.content[0].status").value("CANCELLED"))
                .andExpect(jsonPath("$.content[0].cancellationReason").value(nullValue()));
    }

    @Test
    void cancellableFilterKeepsOnlyPreparingPaidOrders() throws Exception {
        mvc.perform(get("/api/admin/orders").param("search", prefix).param("cancellable", "true")
                .with(user("viewer").authorities(new SimpleGrantedAuthority("MENU_ADMIN_ACCESS"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].orderId").value(ids.get(2)))
                .andExpect(jsonPath("$.content[0].status").value("PAID"))
                .andExpect(jsonPath("$.content[0].deliveryStatus").value("PREPARING"));

        var shipped = orders.findByIdForUpdate(ids.get(2)).orElseThrow();
        deliveries.findByOrderId(shipped.getId()).orElseThrow().changeStatus(
                com.bulkup.raptor.delivery.domain.DeliveryStatus.OUT_FOR_DELIVERY, Instant.parse("2026-11-02T00:00:00Z"));
        orders.flush();
        em.clear();
        mvc.perform(get("/api/admin/orders").param("search", prefix).param("cancellable", "true")
                .with(user("viewer").authorities(new SimpleGrantedAuthority("MENU_ADMIN_ACCESS"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void listsCreatedOrdersBeforePaymentPreparationAndOrdersFromDifferentMembers() throws Exception {
        mvc.perform(get("/api/admin/orders").param("search", prefix).with(user("viewer")
                .authorities(new SimpleGrantedAuthority("MENU_ADMIN_ACCESS"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content[0].orderId").value(ids.get(2)))
                .andExpect(jsonPath("$.content[0].status").value("PAID"))
                .andExpect(jsonPath("$.content[0].deliveryStatus").value("PREPARING"))
                .andExpect(jsonPath("$.content[0].cancellationPending").value(false))
                .andExpect(jsonPath("$.content[1].status").value("CREATED"))
                .andExpect(jsonPath("$.content[1].deliveryStatus").value(nullValue()))
                .andExpect(jsonPath("$.content[2].orderId").value(ids.get(0)))
                .andExpect(jsonPath("$.content[2].status").value("CREATED"))
                .andExpect(jsonPath("$.content[2].items[0].productName").value("주문 당시 상품"))
                .andExpect(jsonPath("$.content[2].items[0].quantity").value(2))
                .andExpect(jsonPath("$.content[2].totalAmount").value(5400))
                .andExpect(jsonPath("$.content[2].delivery").doesNotExist())
                .andExpect(jsonPath("$.content[2].buyer.password").doesNotExist());
    }

    @Test
    void cancelRequiresOrderManageRatherThanMenuAccess() throws Exception {
        mvc.perform(post("/api/admin/orders/" + ids.get(2) + "/cancel")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/admin/orders/" + ids.get(2) + "/cancel")
                .with(user("viewer").authorities(new SimpleGrantedAuthority("MENU_ADMIN_ACCESS"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void deniesAnonymousAndMissingMenuPermissionOnBothListAndDetail() throws Exception {
        for (String path : List.of("/api/admin/orders", "/api/admin/orders/" + ids.getFirst())) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
            mvc.perform(get(path).with(user("member").roles("MEMBER"))).andExpect(status().isForbidden());
            mvc.perform(get(path).with(user("admin").roles("ADMIN"))).andExpect(status().isForbidden());
            mvc.perform(get(path).with(user("operator").authorities(new SimpleGrantedAuthority("ORDER_MANAGE"))))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void validatesPaginationStatusSearchAndDetailId() throws Exception {
        for (String query : List.of("page=-1", "size=0", "size=101", "page=abc", "status=INVALID", "search=" + "x".repeat(101))) {
            mvc.perform(get("/api/admin/orders?" + query).with(user("viewer")
                    .authorities(new SimpleGrantedAuthority("MENU_ADMIN_ACCESS"))))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        }
        for (String id : List.of("0", "-1", "abc")) {
            mvc.perform(get("/api/admin/orders/" + id).with(user("viewer")
                    .authorities(new SimpleGrantedAuthority("MENU_ADMIN_ACCESS"))))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/admin/orders/" + Long.MAX_VALUE).with(user("viewer")
                .authorities(new SimpleGrantedAuthority("MENU_ADMIN_ACCESS"))))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ORDER_NOT_FOUND"));
    }

    @Test
    void filtersSearchesAndTreatsWildcardsLiterally() {
        assertThat(service.list(0, 10, prefix, AdminOrderStatus.CREATED).totalElements()).isEqualTo(2);
        assertThat(service.list(0, 10, "  " + prefix.toUpperCase() + "  ", AdminOrderStatus.PAID).totalElements()).isEqualTo(1);
        assertThat(service.list(0, 10, prefix + "둘째주문자", null).content())
                .extracting(AdminOrderPageResponse.Summary::orderId).containsExactly(ids.get(2));
        assertThat(service.list(0, 10, prefix + "1@example.test", null).totalElements()).isEqualTo(2);
        assertThat(service.list(0, 10, String.valueOf(ids.getFirst()), null).content())
                .extracting(AdminOrderPageResponse.Summary::orderId).contains(ids.getFirst());
        for (String term : List.of(prefix + "%", prefix + "_", prefix + "\\", "' OR 1=1 --", "99999999999999999999999999")) {
            assertThat(service.list(0, 10, term, null).content()).as(term).isEmpty();
        }
    }

    @Test
    void pagesWithStableOrderAndClampsOutOfRangeAndEmptyResults() {
        var first = service.list(0, 2, prefix, null);
        var last = service.list(Integer.MAX_VALUE, 2, prefix, null);
        assertThat(first.totalPages()).isEqualTo(2);
        assertThat(first.content()).extracting(AdminOrderPageResponse.Summary::orderId).containsExactly(ids.get(2), ids.get(1));
        assertThat(last.page()).isEqualTo(1);
        assertThat(last.content()).extracting(AdminOrderPageResponse.Summary::orderId).containsExactly(ids.get(0));
        var empty = service.list(99, 10, prefix + "missing", null);
        assertThat(empty.content()).isEmpty();
        assertThat(empty.page()).isZero();
        assertThat(empty.totalElements()).isZero();
        assertThat(empty.totalPages()).isZero();
    }

    @Test
    void detailPreservesSnapshotAndDeliveryAndDistinguishesAbsentReadyAndPaidPayments() throws Exception {
        products.findById(product.getId()).orElseThrow().change("현재 상품명", "설명", 9900, ProductCategory.SUPPLEMENT, null, "🥛");
        products.flush();
        em.clear();
        var noPayment = service.get(ids.getFirst());
        assertThat(noPayment.payment()).isNull();
        assertThat(noPayment.order().items().getFirst().productName()).isEqualTo("주문 당시 상품");
        assertThat(noPayment.order().items().getFirst().unitPrice()).isEqualTo(1200);
        assertThat(noPayment.order().totalAmount()).isEqualTo(5400);
        assertThat(noPayment.order().delivery().address()).isEqualTo("서울");
        assertThat(service.get(ids.get(1)).payment().status().name()).isEqualTo("READY");
        mvc.perform(get("/api/admin/orders/" + ids.get(2)).with(user("viewer")
                .authorities(new SimpleGrantedAuthority("MENU_ADMIN_ACCESS"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.order.status").value("PAID"))
                .andExpect(jsonPath("$.order.deliveryStatus").value("PREPARING"))
                .andExpect(jsonPath("$.buyer.name").value(prefix + "둘째주문자"))
                .andExpect(jsonPath("$.order.delivery.phone").value("01012345678"))
                .andExpect(jsonPath("$.payment.status").value("PAID"))
                .andExpect(jsonPath("$.payment.webhookVerifiedAt").isNotEmpty())
                .andExpect(jsonPath("$.payment.orderId").value(ids.get(2)));
    }
}
