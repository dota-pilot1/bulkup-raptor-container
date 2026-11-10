package com.bulkup.raptor.inventory;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.inventory.domain.StockAdjustment;
import com.bulkup.raptor.inventory.repository.StockAdjustmentRepository;
import com.bulkup.raptor.product.domain.Product;
import com.bulkup.raptor.product.domain.ProductCategory;
import com.bulkup.raptor.product.repository.ProductRepository;
import com.bulkup.raptor.role.repository.RoleRepository;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Transactional
class StockAdjustmentApiIntegrationTest {
    @Autowired WebApplicationContext context;
    @Autowired ProductRepository products;
    @Autowired MemberRepository members;
    @Autowired RoleRepository roles;
    @Autowired StockAdjustmentRepository adjustments;
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;
    MockMvc mvc;
    Product product;
    Product emptyProduct;
    Member actor;
    Long firstId;
    Long secondId;
    Long newestId;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        String prefix = "stock-history-" + UUID.randomUUID();
        actor = members.saveAndFlush(Member.pending(prefix + "@example.test", "hash", "재고 담당자",
                Instant.now(), roles.findByCode("MEMBER").orElseThrow()));
        product = products.saveAndFlush(Product.create(prefix, "설명", 1000,
                ProductCategory.SUPPLEMENT, null, "box", 20));
        emptyProduct = products.saveAndFlush(Product.create(prefix + "empty", "설명", 1000,
                ProductCategory.SUPPLEMENT, null, "box", 0));
        firstId = adjustments.saveAndFlush(StockAdjustment.create(product, actor, 5, 10, 15, "입고")).getId();
        secondId = adjustments.saveAndFlush(StockAdjustment.create(product, actor, -3, 15, 12, "파손")).getId();
        newestId = adjustments.saveAndFlush(StockAdjustment.create(product, actor, 8, 12, 20, "추가 입고")).getId();
        jdbc.update("UPDATE stock_adjustments SET created_at = ? WHERE product_id = ?",
                Instant.parse("2026-11-01T00:00:00Z").atOffset(java.time.ZoneOffset.UTC), product.getId());
        jdbc.update("UPDATE stock_adjustments SET created_at = ? WHERE id = ?",
                Instant.parse("2026-11-02T00:00:00Z").atOffset(java.time.ZoneOffset.UTC), newestId);
        em.clear();
    }

    String path(Long id) {
        return "/api/admin/products/" + id + "/stock-adjustments";
    }

    @Test
    void listsOnlySelectedProductWithActorAndStableNewestFirstOrder() throws Exception {
        adjustments.saveAndFlush(StockAdjustment.create(emptyProduct, actor, 1, 0, 1, "다른 상품"));
        mvc.perform(get(path(product.getId())).with(user("viewer").authorities(new SimpleGrantedAuthority("MENU_ADMIN_ACCESS"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0)).andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalElements").value(3)).andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.content[0].id").value(newestId))
                .andExpect(jsonPath("$.content[1].id").value(secondId))
                .andExpect(jsonPath("$.content[2].id").value(firstId))
                .andExpect(jsonPath("$.content[0].productId").value(product.getId()))
                .andExpect(jsonPath("$.content[0].actorId").value(actor.getId()))
                .andExpect(jsonPath("$.content[0].actorName").value("재고 담당자"))
                .andExpect(jsonPath("$.content[0].type").value("INCREASE"))
                .andExpect(jsonPath("$.content[0].delta").value(8))
                .andExpect(jsonPath("$.content[0].beforeQuantity").value(12))
                .andExpect(jsonPath("$.content[0].afterQuantity").value(20))
                .andExpect(jsonPath("$.content[0].reason").value("추가 입고"))
                .andExpect(jsonPath("$.content[0].createdAt").value("2026-11-02T00:00:00Z"))
                .andExpect(jsonPath("$.content[1].type").value("DECREASE"))
                .andExpect(jsonPath("$.content[0].actor.email").doesNotExist());
        assertThat(products.findById(product.getId()).orElseThrow().getStockQuantity()).isEqualTo(20);
    }

    @Test
    void supportsPagesAndReturnsEmptyContentBeyondLastPage() throws Exception {
        for (int page : List.of(0, 1, 99)) {
            var response = mvc.perform(get(path(product.getId())).param("page", String.valueOf(page)).param("size", "2")
                    .with(user("viewer").authorities(new SimpleGrantedAuthority("MENU_ADMIN_ACCESS"))))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.page").value(page))
                    .andExpect(jsonPath("$.totalElements").value(3)).andExpect(jsonPath("$.totalPages").value(2));
            if (page == 0) response.andExpect(jsonPath("$.content.length()").value(2));
            if (page == 1) response.andExpect(jsonPath("$.content[0].id").value(firstId));
            if (page == 99) response.andExpect(jsonPath("$.content").isEmpty());
        }
    }

    @Test
    void mapsCurrentActorNameDirectlyFromSqlJoin() throws Exception {
        jdbc.update("UPDATE members SET name = ? WHERE id = ?", "변경된 담당자", actor.getId());
        mvc.perform(get(path(product.getId())).with(user("viewer")
                        .authorities(new SimpleGrantedAuthority("MENU_ADMIN_ACCESS"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content[0].actorName").value("변경된 담당자"))
                .andExpect(jsonPath("$.content[0].createdAt").value("2026-11-02T00:00:00Z"));
    }

    @Test
    void returnsEmptyHistoryWithoutInventingInitialStockRecords() throws Exception {
        mvc.perform(get(path(emptyProduct.getId())).with(user("viewer").authorities(new SimpleGrantedAuthority("MENU_ADMIN_ACCESS"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content").isEmpty())
                .andExpect(jsonPath("$.totalElements").value(0)).andExpect(jsonPath("$.totalPages").value(0));
    }

    @Test
    void enforcesLoginAndExplicitAdminMenuPermission() throws Exception {
        mvc.perform(get(path(product.getId()))).andExpect(status().isUnauthorized());
        mvc.perform(get(path(product.getId())).with(user("member").roles("MEMBER"))).andExpect(status().isForbidden());
        mvc.perform(get(path(product.getId())).with(user("admin").roles("ADMIN"))).andExpect(status().isForbidden());
        mvc.perform(get(path(product.getId())).with(user("operator").authorities(new SimpleGrantedAuthority("PRODUCT_MANAGE"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void validatesIdentifiersPaginationAndOffsetOverflow() throws Exception {
        for (String query : List.of("page=-1", "size=0", "size=101", "page=abc", "size=abc", "page=2147483647&size=2")) {
            mvc.perform(get(path(product.getId()) + "?" + query)
                    .with(user("viewer").authorities(new SimpleGrantedAuthority("MENU_ADMIN_ACCESS"))))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        }
        for (String id : List.of("0", "-1", "abc")) {
            mvc.perform(get("/api/admin/products/" + id + "/stock-adjustments")
                    .with(user("viewer").authorities(new SimpleGrantedAuthority("MENU_ADMIN_ACCESS"))))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(get(path(Long.MAX_VALUE)).with(user("viewer").authorities(new SimpleGrantedAuthority("MENU_ADMIN_ACCESS"))))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("PRODUCT_NOT_FOUND"));
    }

    @Test
    void preventsDeletingAProductReferencedByHistory() {
        assertThatThrownBy(() -> jdbc.update("DELETE FROM products WHERE id = ?", product.getId()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    static Stream<Arguments> invalidRows() {
        return Stream.of(
                Arguments.of("INCREASE", 0, 10, 10, "입고"),
                Arguments.of("INCREASE", -1, 10, 9, "입고"),
                Arguments.of("DECREASE", 1, 10, 11, "감소"),
                Arguments.of("INCREASE", 2, 10, 11, "입고"),
                Arguments.of("DECREASE", -11, 10, -1, "감소"),
                Arguments.of("INCREASE", 1, 0, 1, "  "),
                Arguments.of("INVALID", 1, 0, 1, "입고"),
                Arguments.of("INCREASE", Integer.MAX_VALUE, 2, 1, "입고"));
    }

    @ParameterizedTest
    @MethodSource("invalidRows")
    void databaseRejectsInvalidHistory(String type, int delta, int before, int after, String reason) {
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO stock_adjustments (product_id, actor_id, type, delta, before_quantity, after_quantity, reason, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, product.getId(), actor.getId(), type, delta, before, after, reason))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
