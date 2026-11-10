package com.bulkup.raptor.admin.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.bulkup.raptor.admin.application.service.AdminPaymentQueryService;
import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.order.domain.Order;
import com.bulkup.raptor.order.repository.OrderRepository;
import com.bulkup.raptor.payment.domain.Payment;
import com.bulkup.raptor.payment.domain.PaymentStatus;
import com.bulkup.raptor.payment.repository.PaymentRepository;
import com.bulkup.raptor.product.domain.Product;
import com.bulkup.raptor.product.domain.ProductCategory;
import com.bulkup.raptor.product.repository.ProductRepository;
import com.bulkup.raptor.role.repository.RoleRepository;
import jakarta.persistence.EntityManager;
import java.time.Instant;
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
class AdminPaymentApiIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired MemberRepository members;
    @Autowired RoleRepository roles;
    @Autowired OrderRepository orders;
    @Autowired ProductRepository products;
    @Autowired PaymentRepository payments;
    @Autowired AdminPaymentQueryService service;
    @Autowired EntityManager em;
    MockMvc mvc;
    String prefix;
    long orderId;
    final Instant paidAt = Instant.parse("2026-10-31T03:00:00Z");

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        prefix = "admin-payment-" + UUID.randomUUID();
        var owner = members.saveAndFlush(Member.pending(prefix + "@example.test", "hash", "결제 목록 테스트",
                Instant.now(), roles.findByCode("MEMBER").orElseThrow()));
        var product = products.saveAndFlush(Product.create("목록 상품", "설명", 1200, ProductCategory.SUPPLEMENT, null, "🥛"));
        for (int i = 0; i < 3; i++) {
            var order = Order.create(owner, UUID.randomUUID(), "test", "수령인", "01012345678", "06236", "서울", "101호");
            order.addItem(product, 2);
            order.calculateShipping();
            orders.saveAndFlush(order);
            var payment = Payment.ready(order);
            if (i > 0) { payment.markPaid(paidAt, "transaction-test", "pg-test", "PaymentMethodEasyPay"); order.markPaid(); }
            if (i == 2) payment.markWebhookVerified();
            payments.saveAndFlush(payment);
            em.createNativeQuery("update payments set payment_id = :newId, created_at = :at where payment_id = :id")
                    .setParameter("newId", prefix + "-" + i)
                    .setParameter("at", paidAt)
                    .setParameter("id", payment.getPaymentId()).executeUpdate();
            if (i == 2) orderId = order.getId();
        }
        em.clear();
    }

    @Test
    void returnsOnlySavedPaymentFieldsToMenuViewer() throws Exception {
        mvc.perform(get("/api/admin/payments").param("search", prefix + "-2")
                .with(user("viewer").authorities(new SimpleGrantedAuthority("MENU_ADMIN_ACCESS"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].orderId").value(orderId))
                .andExpect(jsonPath("$.content[0].totalAmount").value(5400))
                .andExpect(jsonPath("$.content[0].currency").value("KRW"))
                .andExpect(jsonPath("$.content[0].paymentMethod").value("PaymentMethodEasyPay"))
                .andExpect(jsonPath("$.content[0].status").value("PAID"))
                .andExpect(jsonPath("$.content[0].paidAt").value(paidAt.toString()))
                .andExpect(jsonPath("$.content[0].webhookVerifiedAt").isNotEmpty())
                .andExpect(jsonPath("$.content[0].transactionId").doesNotExist())
                .andExpect(jsonPath("$.content[0].member").doesNotExist());
    }

    @Test
    void requiresMenuPermissionEvenForAdminRole() throws Exception {
        mvc.perform(get("/api/admin/payments")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/payments").with(user("member").roles("MEMBER"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/payments").with(user("admin").roles("ADMIN"))).andExpect(status().isForbidden());
    }

    @Test
    void rejectsInvalidPaginationAndFilters() throws Exception {
        for (String query : new String[]{"page=-1", "size=0", "size=101", "page=abc", "status=INVALID", "webhookVerified=INVALID", "search=" + "x".repeat(101)}) {
            mvc.perform(get("/api/admin/payments?" + query).with(user("viewer")
                    .authorities(new SimpleGrantedAuthority("MENU_ADMIN_ACCESS"))))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        }
    }

    @Test
    void pagesWithStableOrderingAndClampsOutOfRangePages() {
        var first = service.list(0, 2, prefix, null, null);
        var last = service.list(Integer.MAX_VALUE, 2, prefix, null, null);
        assertThat(first.totalElements()).isEqualTo(3);
        assertThat(first.totalPages()).isEqualTo(2);
        assertThat(first.content()).extracting(AdminPaymentPageResponse.Item::paymentId).containsExactly(prefix + "-2", prefix + "-1");
        assertThat(last.page()).isEqualTo(1);
        assertThat(last.content()).extracting(AdminPaymentPageResponse.Item::paymentId).containsExactly(prefix + "-0");
    }

    @Test
    void combinesStatusAndWebhookFiltersWithoutTreatingPaidAsWebhookVerified() {
        assertThat(service.list(0, 10, prefix, PaymentStatus.PAID, null).totalElements()).isEqualTo(2);
        assertThat(service.list(0, 10, prefix, PaymentStatus.PAID, true).content())
                .extracting(AdminPaymentPageResponse.Item::paymentId).containsExactly(prefix + "-2");
        var frontendOnly = service.list(0, 10, prefix, PaymentStatus.PAID, false).content().getFirst();
        assertThat(frontendOnly.paymentId()).isEqualTo(prefix + "-1");
        assertThat(frontendOnly.webhookVerifiedAt()).isNull();
        assertThat(frontendOnly.paidAt()).isEqualTo(paidAt);
        var ready = service.list(0, 10, prefix, PaymentStatus.READY, false).content().getFirst();
        assertThat(ready.paymentMethod()).isNull();
        assertThat(ready.paidAt()).isNull();
        var empty = service.list(99, 10, prefix, PaymentStatus.READY, true);
        assertThat(empty.page()).isZero();
        assertThat(empty.totalPages()).isZero();
        assertThat(empty.content()).isEmpty();
    }

    @Test
    void searchesExactOrderNumberOrLiteralCaseInsensitivePaymentId() {
        assertThat(service.list(0, 10, "  " + prefix.toUpperCase() + "  ", null, null).totalElements()).isEqualTo(3);
        assertThat(service.list(0, 10, String.valueOf(orderId), null, true).content())
                .extracting(AdminPaymentPageResponse.Item::paymentId).contains(prefix + "-2");
        for (String term : new String[]{prefix + "%", prefix + "_", prefix + "\\", "' OR 1=1 --", "999999999999999999999999999999"}) {
            assertThat(service.list(0, 10, term, null, null).content()).as(term).isEmpty();
        }
    }
}
