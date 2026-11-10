package com.bulkup.raptor.order.application.service;

import com.bulkup.raptor.auth.domain.MemberStatus;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.*;
import com.bulkup.raptor.delivery.domain.DeliveryStatus;
import com.bulkup.raptor.delivery.repository.DeliveryRepository;
import com.bulkup.raptor.inventory.application.service.StockReservationService;
import com.bulkup.raptor.order.repository.OrderRepository;
import com.bulkup.raptor.payment.application.service.*;
import com.bulkup.raptor.payment.application.service.CancelUnpaidPaymentService.Result;
import com.bulkup.raptor.payment.domain.PaymentStatus;
import com.bulkup.raptor.payment.repository.PaymentRepository;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
public class OrderCancellationService {
    private final MemberRepository members;
    private final OrderRepository orders;
    private final PaymentRepository payments;
    private final DeliveryRepository deliveries;
    private final StockReservationService stock;
    private final CancelUnpaidPaymentService unpaid;
    private final PaymentCancellationExecutor refunds;
    private final TransactionTemplate transactions;

    private record Target(Long ownerId, String paymentId, long amount, String currency) {}

    public Result cancel(Long memberId, Long orderId) { return cancel(memberId, orderId, null); }

    public Result cancel(Long memberId, Long orderId, String reason) {
        return cancel(memberId, orderId, reason, false);
    }

    public Result cancelAsAdmin(Long adminId, Long orderId, String reason) {
        return cancel(adminId, orderId, reason, true);
    }

    public record SelectedCancellation(Long orderId, boolean succeeded, String orderStatus, Boolean pending, String code, String message) {}

    public List<SelectedCancellation> cancelSelectedAsAdmin(Long adminId, List<Long> orderIds, String reason) {
        if (orderIds == null || orderIds.isEmpty() || orderIds.size() > 50
                || orderIds.stream().anyMatch(id -> id == null || id <= 0)
                || new HashSet<>(orderIds).size() != orderIds.size()
                || (reason != null && reason.length() > 200)) {
            throw new BusinessException(ErrorCode.INVALID_INPUT);
        }
        var storedReason = reason == null || reason.isBlank() ? null : reason.trim();
        var results = new ArrayList<SelectedCancellation>();
        for (Long orderId : orderIds) {
            try {
                var result = cancelAsAdmin(adminId, orderId, storedReason);
                results.add(new SelectedCancellation(result.orderId(), true, result.orderStatus(), result.pending(), null, null));
            } catch (BusinessException exception) {
                results.add(new SelectedCancellation(orderId, false, null, null, exception.getErrorCode().name(), exception.getMessage()));
            } catch (RuntimeException exception) {
                results.add(new SelectedCancellation(orderId, false, null, null, ErrorCode.ORDER_CANCELLATION_UNAVAILABLE.name(),
                        ErrorCode.ORDER_CANCELLATION_UNAVAILABLE.getDefaultMessage()));
            }
        }
        return results;
    }

    private Result cancel(Long actorId, Long orderId, String reason, boolean admin) {
        if (reason != null && reason.length() > 200) throw new BusinessException(ErrorCode.INVALID_INPUT);
        if (actorId == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
        if (orderId == null || orderId <= 0) throw new BusinessException(ErrorCode.INVALID_INPUT);
        var target = transactions.execute(tx -> {
            var actor = members.findByIdForUpdate(actorId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_REQUIRED));
            if (actor.getStatus() != MemberStatus.ACTIVE) throw new BusinessException(ErrorCode.MEMBER_SUSPENDED);
            var order = admin
                    ? orders.findByIdForUpdate(orderId).orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND))
                    : orders.findByIdAndMemberIdForUpdate(orderId, actorId)
                            .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND));
            Long ownerId = order.getMember().getId();
            if ("CANCELLED".equals(order.getStatus()) && order.isPaidCancellationPending()) {
                var payment = payments.findByOrderId(orderId).orElseThrow();
                return new Target(ownerId, payment.getPaymentId(), payment.getTotalAmount(), payment.getCurrency());
            }
            if (!"PAID".equals(order.getStatus())) {
                if ("CREATED".equals(order.getStatus())) order.rememberCancellationReason(reason);
                return new Target(ownerId, null, 0, null);
            }
            var delivery = deliveries.findByOrderId(orderId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_CANCELLATION_UNAVAILABLE));
            if (delivery.getStatus() == DeliveryStatus.OUT_FOR_DELIVERY)
                throw new BusinessException(ErrorCode.ORDER_CANCELLATION_IN_TRANSIT);
            if (delivery.getStatus() == DeliveryStatus.DELIVERED)
                throw new BusinessException(ErrorCode.ORDER_CANCELLATION_DELIVERED);
            var payment = payments.findByOrderId(orderId)
                    .filter(p -> p.getStatus() == PaymentStatus.PAID)
                    .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_CANCELLATION_UNAVAILABLE));
            if (order.isInventoryManaged() && !"CONFIRMED".equals(stock.snapshot(order).status()))
                throw new BusinessException(ErrorCode.STOCK_RESERVATION_CONFLICT);
            order.rememberCancellationReason(reason);
            order.requestPaidCancellation();
            return new Target(ownerId, payment.getPaymentId(), payment.getTotalAmount(), payment.getCurrency());
        });
        if (target.paymentId() == null) {
            var result = unpaid.cancel(target.ownerId(), orderId);
            // A payment verification may have won the race while the unpaid path was running.
            return "PAID".equals(result.orderStatus()) ? cancel(actorId, orderId, reason, admin) : result;
        }
        refunds.reconcile(target.paymentId());
        return transactions.execute(tx -> {
            var order = orders.findByIdForUpdate(orderId).orElseThrow();
            return new Result(orderId, order.getStatus(), stock.snapshot(order).status(), order.isPaidCancellationPending());
        });
    }

}
