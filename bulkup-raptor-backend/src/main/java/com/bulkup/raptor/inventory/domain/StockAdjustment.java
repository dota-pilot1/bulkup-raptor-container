package com.bulkup.raptor.inventory.domain;

import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.product.domain.Product;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "stock_adjustments")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StockAdjustment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false, updatable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "actor_id", nullable = false, updatable = false)
    private Member actor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8, updatable = false)
    private StockAdjustmentType type;

    @Column(nullable = false, updatable = false)
    private int delta;

    @Column(name = "before_quantity", nullable = false, updatable = false)
    private int beforeQuantity;

    @Column(name = "after_quantity", nullable = false, updatable = false)
    private int afterQuantity;

    @Column(nullable = false, length = 200, updatable = false)
    private String reason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    // 재고 변경 자체는 호출한 서비스의 트랜잭션에서 처리한다. 이 팩터리는 이력만 구성한다.
    public static StockAdjustment create(Product product, Member actor, int delta,
            int beforeQuantity, int afterQuantity, String reason) {
        if (delta == 0 || beforeQuantity < 0 || afterQuantity < 0
                || (long) beforeQuantity + delta != afterQuantity) {
            throw new IllegalArgumentException("재고 변경 전후 수량과 증감량이 올바르지 않습니다.");
        }
        String trimmedReason = reason == null ? "" : reason.trim();
        if (trimmedReason.isBlank() || trimmedReason.length() > 200) {
            throw new IllegalArgumentException("변경 사유는 1자 이상 200자 이하여야 합니다.");
        }
        var adjustment = new StockAdjustment();
        adjustment.product = Objects.requireNonNull(product);
        adjustment.actor = Objects.requireNonNull(actor);
        adjustment.type = delta > 0 ? StockAdjustmentType.INCREASE : StockAdjustmentType.DECREASE;
        adjustment.delta = delta;
        adjustment.beforeQuantity = beforeQuantity;
        adjustment.afterQuantity = afterQuantity;
        adjustment.reason = trimmedReason;
        return adjustment;
    }

    @Column(name = "order_id", updatable = false)
    private Long orderId;

    @Column(nullable = false, length = 24, updatable = false)
    private String cause = "MANUAL_ADJUSTMENT";

    public static StockAdjustment sale(Product product, Member buyer, Long orderId, int quantity, int before) {
        var adjustment = create(product, buyer, -quantity, before, product.getStockQuantity(), "주문 결제 재고 차감");
        adjustment.orderId = Objects.requireNonNull(orderId);
        adjustment.cause = "ORDER_SALE";
        return adjustment;
    }

    public static StockAdjustment cancellation(Product product, Member buyer, Long orderId, int quantity, int before) {
        var adjustment = create(product, buyer, quantity, before, product.getStockQuantity(), "주문 취소 재고 복구");
        adjustment.orderId = Objects.requireNonNull(orderId);
        adjustment.cause = "ORDER_CANCELLATION";
        return adjustment;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
