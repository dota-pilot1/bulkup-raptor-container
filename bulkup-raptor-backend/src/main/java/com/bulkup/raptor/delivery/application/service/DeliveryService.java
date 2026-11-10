package com.bulkup.raptor.delivery.application.service;

import com.bulkup.raptor.auth.domain.MemberStatus;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.*;
import com.bulkup.raptor.delivery.api.ChangeDeliveryStatusRequest;
import com.bulkup.raptor.delivery.api.DeliveryResponses.*;
import com.bulkup.raptor.delivery.api.StartDeliveriesResponse;
import com.bulkup.raptor.delivery.domain.*;
import com.bulkup.raptor.delivery.repository.*;
import com.bulkup.raptor.order.repository.OrderRepository;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
@RequiredArgsConstructor
public class DeliveryService {
    private final DeliveryRepository deliveries;
    private final DeliveryStatusHistoryRepository history;
    private final OrderRepository orders;
    private final MemberRepository members;
    private final TransactionTemplate transactions;

    @Transactional(readOnly = true)
    public Page list(int page, int size, String search, DeliveryStatus status) {
        String term = search.trim().toLowerCase(Locale.ROOT);
        Specification<Delivery> condition = (root, query, cb) -> {
            var conditions = new ArrayList<Predicate>();
            conditions.add(cb.equal(root.get("order").get("status"), "PAID"));
            if (status != null) conditions.add(cb.equal(root.get("status"), status));
            if (!term.isEmpty()) {
                String escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
                Predicate match = cb.like(cb.lower(root.get("recipientName")), "%" + escaped + "%", '\\');
                try { match = cb.or(match, cb.equal(root.get("order").get("id"), Long.parseLong(term))); }
                catch (NumberFormatException ignored) { /* Non-numeric terms search the recipient snapshot. */ }
                conditions.add(match);
            }
            Class<?> resultType = query == null ? null : query.getResultType();
            if (status == DeliveryStatus.PREPARING && resultType != Long.class && resultType != long.class) {
                query.orderBy(
                        cb.asc(addressKey(cb, root, "postalCode")),
                        cb.asc(addressKey(cb, root, "address")),
                        cb.asc(addressKey(cb, root, "addressDetail")),
                        cb.desc(root.get("createdAt")),
                        cb.desc(root.get("id")));
            }
            return cb.and(conditions.toArray(Predicate[]::new));
        };
        long total = deliveries.count(condition);
        int lastPage = (int) Math.min(Integer.MAX_VALUE / size, total == 0 ? 0 : (total - 1) / size);
        Sort sort = status == DeliveryStatus.PREPARING
                ? Sort.unsorted()
                : Sort.by(Sort.Order.asc("createdAt"), Sort.Order.asc("id"));
        var result = deliveries.findAll(condition, PageRequest.of(Math.min(page, lastPage), size, sort));
        // Load order/item snapshots for only the current page, without collection pagination.
        if (result.hasContent()) {
            var orderIds = result.getContent().stream().map(d -> d.getOrder().getId()).toList();
            orders.findAdminOrdersByIds(orderIds);
        }
        return new Page(result.getContent().stream().map(Summary::from).toList(), result.getNumber(),
                size, result.getTotalPages(), result.getTotalElements());
    }

    private static Expression<String> addressKey(CriteriaBuilder cb, Root<Delivery> root, String field) {
        Expression<String> trimmed = cb.lower(cb.trim(root.get(field)));
        return cb.function("regexp_replace", String.class, trimmed, cb.literal("\\s+"), cb.literal(" "), cb.literal("g"));
    }

    @Transactional(readOnly = true)
    public AdminDetail get(Long id) {
        return adminDetail(deliveries.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.DELIVERY_NOT_FOUND)));
    }

    @Transactional(readOnly = true)
    public CustomerDetail getForOrder(Long memberId, Long orderId) {
        if (memberId == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
        // Return the same order-not-found error for missing and foreign orders.
        orders.findByIdAndMemberId(orderId, memberId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND));
        var delivery = deliveries.findByOrderId(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.DELIVERY_NOT_FOUND));
        var entries = history.findByDeliveryIdOrderByCreatedAtAscIdAsc(delivery.getId());
        return new CustomerDetail(deliveryInfo(delivery, entries), entries.stream().map(PublicHistory::from).toList());
    }

    public List<StartDeliveriesResponse.Item> startSelected(Long actorId, List<Long> orderIds, DeliveryStatus target) {
        if (target != DeliveryStatus.OUT_FOR_DELIVERY && target != DeliveryStatus.DELIVERED) {
            throw new BusinessException(ErrorCode.INVALID_INPUT);
        }
        if (orderIds == null || orderIds.isEmpty() || orderIds.size() > 50
                || orderIds.stream().anyMatch(id -> id == null || id <= 0)
                || new HashSet<>(orderIds).size() != orderIds.size()) {
            throw new BusinessException(ErrorCode.INVALID_INPUT);
        }
        transactions.executeWithoutResult(tx -> {
            if (actorId == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
            var member = members.findById(actorId).orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_REQUIRED));
            if (member.getStatus() != MemberStatus.ACTIVE) throw new BusinessException(ErrorCode.MEMBER_SUSPENDED);
        });
        var results = new ArrayList<StartDeliveriesResponse.Item>();
        for (Long orderId : orderIds) {
            try {
                String status = transactions.execute(tx -> advanceOne(actorId, orderId, target));
                results.add(new StartDeliveriesResponse.Item(orderId, true, status, null, null));
            } catch (BusinessException exception) {
                results.add(new StartDeliveriesResponse.Item(orderId, false, null, exception.getErrorCode().name(), exception.getMessage()));
            } catch (RuntimeException exception) {
                results.add(new StartDeliveriesResponse.Item(orderId, false, null, ErrorCode.DELIVERY_STATUS_CONFLICT.name(),
                        ErrorCode.DELIVERY_STATUS_CONFLICT.getDefaultMessage()));
            }
        }
        return results;
    }

    private String advanceOne(Long actorId, Long orderId, DeliveryStatus target) {
        var actor = members.findById(actorId).orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_REQUIRED));
        var order = orders.findByIdForUpdate(orderId).orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND));
        if (!"PAID".equals(order.getStatus())) throw new BusinessException(ErrorCode.DELIVERY_ORDER_NOT_PAID);
        if (order.isPaidCancellationPending()) throw new BusinessException(ErrorCode.DELIVERY_CANCELLATION_PENDING);
        var delivery = deliveries.findByOrderId(orderId).orElseThrow(() -> new BusinessException(ErrorCode.DELIVERY_NOT_FOUND));
        delivery = deliveries.findByIdForUpdate(delivery.getId()).orElseThrow(() -> new BusinessException(ErrorCode.DELIVERY_NOT_FOUND));
        if (delivery.getStatus() == target) return delivery.getStatus().name();
        var previous = delivery.getStatus();
        var now = Instant.now();
        delivery.changeStatus(target, now);
        history.save(DeliveryStatusHistory.record(delivery, previous, actor, null, now));
        deliveries.flush();
        return delivery.getStatus().name();
    }

    @Transactional
    public AdminDetail changeStatus(Long actorId, Long id, ChangeDeliveryStatusRequest request) {
        if (actorId == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
        var actor = members.findById(actorId).orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_REQUIRED));
        if (actor.getStatus() != MemberStatus.ACTIVE) throw new BusinessException(ErrorCode.MEMBER_SUSPENDED);
        // Cancellation and dispatch always lock the order before the delivery.
        var orderId = deliveries.findOrderId(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.DELIVERY_NOT_FOUND));
        var order = orders.findByIdForUpdate(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND));
        var delivery = deliveries.findByIdForUpdate(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.DELIVERY_NOT_FOUND));
        if (!"PAID".equals(order.getStatus())) throw new BusinessException(ErrorCode.DELIVERY_ORDER_NOT_PAID);
        if (order.isPaidCancellationPending()) throw new BusinessException(ErrorCode.DELIVERY_CANCELLATION_PENDING);
        // Retries of the same target state succeed even with the original version, without new history.
        if (delivery.getStatus() == request.status()) return adminDetail(delivery);
        if (delivery.getVersion() != request.expectedVersion()) throw new BusinessException(ErrorCode.DELIVERY_VERSION_CONFLICT);
        var previous = delivery.getStatus();
        var now = Instant.now();
        delivery.changeStatus(request.status(), now);
        String reason = request.reason() == null || request.reason().isBlank() ? null : request.reason().trim();
        history.save(DeliveryStatusHistory.record(delivery, previous, actor, reason, now));
        deliveries.flush();
        return adminDetail(delivery);
    }

    // The latest successful status change determines the current handler; retries do not reassign it.
    private Info deliveryInfo(Delivery delivery, List<DeliveryStatusHistory> entries) {
        return Info.from(delivery, entries.isEmpty() ? null : entries.getLast().getActor());
    }

    private AdminDetail adminDetail(Delivery delivery) {
        var entries = history.findByDeliveryIdOrderByCreatedAtAscIdAsc(delivery.getId());
        return new AdminDetail(deliveryInfo(delivery, entries), entries.stream().map(AdminHistory::from).toList());
    }
}
