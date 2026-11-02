package com.bulkup.raptor.payment.domain;

import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.order.domain.Order;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "payments", uniqueConstraints = @UniqueConstraint(
        name = "uk_payments_order", columnNames = "order_id"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Payment {
    @Id
    @Column(name = "payment_id", length = 64)
    private String paymentId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(name = "order_name", nullable = false, length = 120)
    private String orderName;

    @Column(name = "total_amount", nullable = false)
    private long totalAmount;

    @Column(nullable = false, length = 3)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PaymentStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "paid_at")
    private Instant paidAt;
    @Column(name = "webhook_verified_at")
    private Instant webhookVerifiedAt;

    @Column(name = "transaction_id", length = 200)
    private String transactionId;
    @Column(name = "pg_tx_id", length = 200)
    private String pgTxId;
    @Column(name = "payment_method", length = 100)
    private String paymentMethod;

    public void markPaid(Instant paidAt, String transactionId, String pgTxId, String paymentMethod) {
        // 반복 검증에서는 최초에 저장한 완료 내역을 유지한다.
        if (status == PaymentStatus.PAID) return;
        this.status = PaymentStatus.PAID;
        this.paidAt = paidAt;
        this.transactionId = transactionId;
        this.pgTxId = pgTxId;
        this.paymentMethod = paymentMethod;
    }

    public void markWebhookVerified() {
        // 중복 웹훅에서도 최초 검증 성공 시각을 유지한다.
        if (webhookVerifiedAt == null) webhookVerifiedAt = Instant.now();
    }

    public static Payment ready(Order order) {
        var payment = new Payment();
        payment.paymentId = "payment-" + UUID.randomUUID();
        payment.order = order;
        payment.member = order.getMember();
        // 결제에 사용할 이름과 금액은 주문 당시 저장된 값에서 가져온다.
        var items = order.getItems();
        payment.orderName = items.getFirst().getProductName()
                + (items.size() > 1 ? " 외 " + (items.size() - 1) + "종" : "");
        payment.totalAmount = order.getTotalAmount();
        payment.currency = "KRW";
        payment.status = PaymentStatus.READY;
        payment.createdAt = Instant.now();
        return payment;
    }
}
