package com.bulkup.raptor.inventory.domain;

import com.bulkup.raptor.order.domain.Order;
import com.bulkup.raptor.product.domain.Product;
import com.bulkup.raptor.common.error.*;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Entity
@Table(name = "stock_reservations")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StockReservation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false, updatable = false) private Order order;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false, updatable = false) private Product product;
    @Column(nullable = false, updatable = false) private int quantity;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private StockReservationStatus status;
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(name = "next_check_at", nullable = false) private Instant nextCheckAt;
    @Column(name = "confirmed_at") private Instant confirmedAt;
    @Column(name = "released_at") private Instant releasedAt;

    public static StockReservation reserve(Order order, Product product, int quantity, Instant expiresAt) {
        product.reserveStock(quantity);
        var reservation = new StockReservation();
        reservation.order = order;
        reservation.product = product;
        reservation.quantity = quantity;
        reservation.status = StockReservationStatus.RESERVED;
        reservation.expiresAt = expiresAt;
        reservation.nextCheckAt = expiresAt;
        return reservation;
    }

    public void reserveAgain(Instant expiresAt) {
        if (status != StockReservationStatus.RELEASED)
            throw new BusinessException(ErrorCode.STOCK_RESERVATION_CONFLICT);
        product.reserveStock(quantity);
        status = StockReservationStatus.RESERVED;
        this.expiresAt = expiresAt;
        nextCheckAt = expiresAt;
        releasedAt = null;
    }

    public boolean holdsStock() {
        return status == StockReservationStatus.RESERVED || status == StockReservationStatus.RELEASE_PENDING
                || status == StockReservationStatus.REVIEW_REQUIRED;
    }

    public void confirm(Instant now) {
        if (status == StockReservationStatus.CONFIRMED) return;
        if (!holdsStock()) throw new BusinessException(ErrorCode.STOCK_RESERVATION_CONFLICT);
        product.confirmStock(quantity);
        status = StockReservationStatus.CONFIRMED;
        confirmedAt = now;
    }

    public void release(Instant now) {
        if (status == StockReservationStatus.RELEASED) return;
        if (!holdsStock()) throw new BusinessException(ErrorCode.STOCK_RESERVATION_CONFLICT);
        product.releaseStock(quantity);
        status = StockReservationStatus.RELEASED;
        releasedAt = now;
    }

    public void refund(Instant now) {
        if (status == StockReservationStatus.RELEASED) return;
        if (status != StockReservationStatus.CONFIRMED)
            throw new BusinessException(ErrorCode.STOCK_RESERVATION_CONFLICT);
        product.adjustStock(quantity);
        status = StockReservationStatus.RELEASED;
        confirmedAt = null;
        releasedAt = now;
    }

    public void resumeForRetry(Instant expiresAt) {
        if (!holdsStock()) throw new BusinessException(ErrorCode.STOCK_RESERVATION_CONFLICT);
        status = StockReservationStatus.RESERVED;
        this.expiresAt = expiresAt;
        nextCheckAt = expiresAt;
    }

    public void requestRelease(Instant now) {
        if (holdsStock()) { status = StockReservationStatus.RELEASE_PENDING; nextCheckAt = now.plusSeconds(60); }
    }

    public void requireReview(Instant now) {
        if (holdsStock()) { status = StockReservationStatus.REVIEW_REQUIRED; nextCheckAt = now.plusSeconds(60); }
    }
}
