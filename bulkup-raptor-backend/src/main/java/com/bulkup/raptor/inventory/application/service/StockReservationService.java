package com.bulkup.raptor.inventory.application.service;

import com.bulkup.raptor.common.error.*;
import com.bulkup.raptor.inventory.domain.*;
import com.bulkup.raptor.inventory.repository.*;
import com.bulkup.raptor.order.domain.Order;
import com.bulkup.raptor.product.repository.ProductRepository;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(propagation = Propagation.MANDATORY)
public class StockReservationService {
    private final ProductRepository products;
    private final StockReservationRepository reservations;
    private final StockAdjustmentRepository adjustments;

    public record Snapshot(String status, Instant expiresAt) {}

    // Mutating callers hold the order lock for the entire transaction.
    // Product locks are acquired below in ascending ID order; no member lock is required.
    public Snapshot prepare(Order order, boolean existingPayment) {
        if (!order.isInventoryManaged()) {
            if ("PAID".equals(order.getStatus())) return new Snapshot("LEGACY", null);
            throw new BusinessException(ErrorCode.STOCK_LEGACY_ORDER);
        }
        var rows = reservations.findByOrderIdOrderByProductIdAsc(order.getId());
        if (!rows.isEmpty()) {
            var snapshot = snapshot(order);
            if ("PAID".equals(order.getStatus()) && "CONFIRMED".equals(snapshot.status())) return snapshot;
            if (!"CREATED".equals(order.getStatus()) || !"RESERVED".equals(snapshot.status())
                    || !snapshot.expiresAt().isAfter(Instant.now()))
                throw new BusinessException(ErrorCode.STOCK_RESERVATION_REVIEW_REQUIRED);
            return snapshot; // Replays never extend the deadline or reserve twice.
        }
        if (existingPayment) throw new BusinessException(ErrorCode.STOCK_RESERVATION_CONFLICT);
        var quantities = new TreeMap<Long, Integer>();
        for (var item : order.getItems()) {
            if (item.getProductId() == null || item.getQuantity() <= 0)
                throw new BusinessException(ErrorCode.PRODUCT_NOT_FOUND);
            quantities.merge(item.getProductId(), item.getQuantity(), Math::addExact);
        }
        Instant expiresAt = Instant.now().plus(Duration.ofMinutes(15));
        // Lock each product in ascending ID order before changing any quantity.
        var locked = quantities.keySet().stream().map(id -> products.findByIdForStockAdjustment(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND))).toList();
        for (var product : locked)
            reservations.save(StockReservation.reserve(order, product, quantities.get(product.getId()), expiresAt));
        reservations.flush();
        return new Snapshot("RESERVED", expiresAt);
    }

    public Snapshot reserveAgain(Order order) {
        Instant expiresAt = Instant.now().plus(Duration.ofMinutes(15));
        for (var row : lockProducts(order)) row.reserveAgain(expiresAt);
        return new Snapshot("RESERVED", expiresAt);
    }

    public Snapshot snapshot(Order order) {
        if (!order.isInventoryManaged()) return new Snapshot("LEGACY", null);
        var rows = reservations.findByOrderIdOrderByProductIdAsc(order.getId());
        if (rows.isEmpty()) return new Snapshot("NOT_RESERVED", null);
        var first = rows.getFirst();
        if (rows.stream().anyMatch(r -> r.getStatus() != first.getStatus()))
            throw new BusinessException(ErrorCode.STOCK_RESERVATION_CONFLICT);
        return new Snapshot(first.getStatus().name(), first.getExpiresAt());
    }

    private List<StockReservation> lockProducts(Order order) {
        var rows = reservations.findByOrderIdOrderByProductIdAsc(order.getId());
        if (rows.isEmpty()) throw new BusinessException(ErrorCode.STOCK_RESERVATION_CONFLICT);
        for (var row : rows) products.findByIdForStockAdjustment(row.getProduct().getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND));
        return rows;
    }

    public void confirm(Order order) {
        if (!order.isInventoryManaged()) {
            // Do not retroactively charge legacy paid orders or accept legacy unpaid orders.
            if (!"PAID".equals(order.getStatus())) throw new BusinessException(ErrorCode.STOCK_LEGACY_ORDER);
            return;
        }
        for (var row : lockProducts(order)) {
            if (row.getStatus() == StockReservationStatus.CONFIRMED) continue;
            int before = row.getProduct().getStockQuantity();
            row.confirm(Instant.now());
            adjustments.save(StockAdjustment.sale(row.getProduct(), order.getMember(), order.getId(), row.getQuantity(), before));
        }
    }

    public void requestRelease(Order order) {
        if (!order.isInventoryManaged()) throw new BusinessException(ErrorCode.STOCK_LEGACY_ORDER);
        for (var row : reservations.findByOrderIdOrderByProductIdAsc(order.getId())) row.requestRelease(Instant.now());
    }

    public void review(Order order) {
        for (var row : reservations.findByOrderIdOrderByProductIdAsc(order.getId())) row.requireReview(Instant.now());
    }

    public void release(Order order, boolean cancelOrder) {
        for (var row : lockProducts(order)) row.release(Instant.now());
        if (cancelOrder && "CREATED".equals(order.getStatus())) order.cancelUnpaid();
    }

    // 결제 재시도 표시가 있어도 예약 시간이 지났으면 미결제 주문을 취소한다.
    public boolean expireUnpaid(Order order) {
        if (!"CREATED".equals(order.getStatus())) return false;
        var state = snapshot(order);
        if (state.expiresAt() == null || state.expiresAt().isAfter(Instant.now())) return false;
        if (!Set.of("RESERVED", "RELEASE_PENDING", "REVIEW_REQUIRED").contains(state.status())) return false;
        order.rememberCancellationReason("결제 시간이 지나 주문을 취소했다");
        release(order, true);
        return true;
    }

    public void refund(Order order) {
        // Legacy orders have no automatic inventory settlement to reverse.
        if (!order.isInventoryManaged()) return;
        for (var row : lockProducts(order)) {
            if (row.getStatus() == StockReservationStatus.RELEASED) continue;
            int before = row.getProduct().getStockQuantity();
            row.refund(Instant.now());
            adjustments.save(StockAdjustment.cancellation(row.getProduct(), order.getMember(), order.getId(), row.getQuantity(), before));
        }
    }

    public void resumeForRetry(Order order) {
        Instant expiresAt = Instant.now().plus(Duration.ofMinutes(15));
        for (var row : lockProducts(order)) row.resumeForRetry(expiresAt);
    }

    public boolean hasValidReservation(Order order) {
        var state = snapshot(order);
        return "RESERVED".equals(state.status()) && state.expiresAt().isAfter(Instant.now());
    }

    public boolean needsReconciliation(Order order) {
        var state = snapshot(order);
        return Set.of("RELEASE_PENDING", "REVIEW_REQUIRED").contains(state.status())
                || ("RESERVED".equals(state.status()) && !state.expiresAt().isAfter(Instant.now()));
    }
}
