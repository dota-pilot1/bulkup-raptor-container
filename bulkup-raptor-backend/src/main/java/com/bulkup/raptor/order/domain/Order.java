package com.bulkup.raptor.order.domain;

import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.product.domain.Product;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "orders", uniqueConstraints = @UniqueConstraint(
        name = "uk_orders_member_request", columnNames = {"member_id", "request_id"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Order {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false) private Member member;
    @Column(name = "request_id", nullable = false) private UUID requestId;
    @Column(name = "request_fingerprint", nullable = false, length = 64) private String requestFingerprint;
    @Column(nullable = false, length = 20) private String status;
    @Column(name = "inventory_managed", nullable = false) private boolean inventoryManaged;
    @Column(name = "paid_cancellation_pending", nullable = false) private boolean paidCancellationPending;
    @Column(name = "cancellation_reason", length = 200) private String cancellationReason;

    public void rememberCancellationReason(String reason) {
        if (cancellationReason != null || reason == null || reason.isBlank()) return;
        cancellationReason = reason.trim();
    }

    public void requestPaidCancellation() {
        if (!Set.of("PAID", "CANCELLED").contains(status)) throw new IllegalStateException("결제 취소 대상 주문만 처리한다.");
        paidCancellationPending = true;
    }

    public void completePaidCancellation() {
        if ("CANCELLED".equals(status) && !paidCancellationPending) return;
        if (!Set.of("PAID", "CANCELLED").contains(status) || !paidCancellationPending)
            throw new IllegalStateException("취소 요청한 결제 완료 주문만 확정한다.");
        status = "CANCELLED";
        paidCancellationPending = false;
    }
    @Column(name = "recipient_name", nullable = false, length = 80) private String recipientName;
    @Column(nullable = false, length = 30) private String phone;
    @Column(name = "postal_code", nullable = false, length = 10) private String postalCode;
    @Column(nullable = false, length = 200) private String address;
    @Column(name = "address_detail", nullable = false, length = 200) private String addressDetail;
    @Column(name = "items_total", nullable = false) private long itemsTotal;
    @Column(name = "shipping_fee", nullable = false) private long shippingFee;
    @Column(name = "total_amount", nullable = false) private long totalAmount;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL)
    @OrderBy("id ASC") private List<OrderItem> items = new ArrayList<>();

    public static Order create(Member member, UUID requestId, String fingerprint,
            String recipientName, String phone, String postalCode, String address, String addressDetail) {
        var order = new Order();
        order.member = member;
        order.requestId = requestId;
        order.requestFingerprint = fingerprint;
        order.status = "CREATED";
        order.inventoryManaged = true;
        order.recipientName = recipientName;
        order.phone = phone;
        order.postalCode = postalCode;
        order.address = address;
        order.addressDetail = addressDetail;
        order.createdAt = Instant.now();
        return order;
    }

    public void addItem(Product product, int quantity) {
        var item = OrderItem.snapshot(this, product, quantity);
        items.add(item);
        itemsTotal = Math.addExact(itemsTotal, item.getLineTotal());
    }

    // 검증 서비스가 결제 완료를 확인한 뒤 호출한다.
    public void markPaid() { status = "PAID"; }

    public void cancelUnpaid() {
        if (!"CREATED".equals(status)) throw new IllegalStateException("미결제 주문만 취소한다.");
        status = "CANCELLED";
    }

    public void calculateShipping() {
        shippingFee = itemsTotal >= 50_000 || itemsTotal == 0 ? 0 : 3_000;
        totalAmount = Math.addExact(itemsTotal, shippingFee);
    }
}
