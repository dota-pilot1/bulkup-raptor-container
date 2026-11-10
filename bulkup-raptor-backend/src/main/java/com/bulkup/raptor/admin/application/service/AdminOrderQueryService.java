package com.bulkup.raptor.admin.application.service;

import com.bulkup.raptor.admin.api.*;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.delivery.domain.Delivery;
import com.bulkup.raptor.delivery.domain.DeliveryStatus;
import com.bulkup.raptor.delivery.repository.DeliveryRepository;
import com.bulkup.raptor.order.application.service.OrderService;
import com.bulkup.raptor.order.domain.Order;
import com.bulkup.raptor.order.repository.OrderRepository;
import com.bulkup.raptor.payment.repository.PaymentRepository;
import jakarta.persistence.criteria.Predicate;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminOrderQueryService {
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private final OrderRepository orders;
    private final PaymentRepository payments;
    private final DeliveryRepository deliveries;
    private final OrderService views;

    @Transactional(readOnly = true)
    public AdminOrderPageResponse list(int page, int size, String search, AdminOrderStatus status) {
        return list(page, size, search, status, false);
    }

    @Transactional(readOnly = true)
    public AdminOrderPageResponse list(int page, int size, String search, AdminOrderStatus status, boolean cancellable) {
        return list(page, size, search, status, cancellable, null, null);
    }

    @Transactional(readOnly = true)
    public AdminOrderPageResponse list(int page, int size, String search, AdminOrderStatus status, boolean cancellable,
            LocalDate from, LocalDate to) {
        if ((from == null) != (to == null) || (from != null && from.isAfter(to))) {
            throw new BusinessException(ErrorCode.INVALID_INPUT);
        }
        String term = search.trim().toLowerCase(Locale.ROOT);
        Specification<Order> condition = (root, query, builder) -> {
            var predicates = new ArrayList<Predicate>();
            if (from != null) {
                predicates.add(builder.greaterThanOrEqualTo(root.get("createdAt"), from.atStartOfDay(SEOUL).toInstant()));
                predicates.add(builder.lessThan(root.get("createdAt"), to.plusDays(1).atStartOfDay(SEOUL).toInstant()));
            }
            if (!term.isEmpty()) {
                String escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
                var member = root.join("member");
                Predicate match = builder.or(
                        builder.like(builder.lower(member.get("name")), "%" + escaped + "%", '\\'),
                        builder.like(builder.lower(member.get("email")), "%" + escaped + "%", '\\'));
                try {
                    match = builder.or(match, builder.equal(root.get("id"), Long.parseLong(term)));
                } catch (NumberFormatException ignored) {
                    // 주문 번호가 아닌 검색어는 주문자 이름·이메일에서만 찾는다.
                }
                predicates.add(match);
            }
            if (cancellable) {
                predicates.add(builder.equal(root.get("status"), "PAID"));
                predicates.add(builder.isFalse(root.get("paidCancellationPending")));
                var preparing = query.subquery(Long.class);
                var delivery = preparing.from(Delivery.class);
                preparing.select(delivery.get("id")).where(
                        builder.equal(delivery.get("order"), root),
                        builder.equal(delivery.get("status"), DeliveryStatus.PREPARING));
                predicates.add(builder.exists(preparing));
            } else if (status != null) {
                predicates.add(builder.equal(root.get("status"), status.name()));
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
        long total = orders.count(condition);
        int lastPage = (int) Math.min(Integer.MAX_VALUE / size, total == 0 ? 0 : (total - 1) / size);
        var result = orders.findAll(condition, PageRequest.of(Math.min(page, lastPage), size,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
        List<AdminOrderPageResponse.Summary> content = List.of();
        if (result.hasContent()) {
            // 컬렉션 fetch join에 페이지네이션을 적용하지 않고, 현재 페이지의 주문만 일괄 조회한다.
            var ids = result.getContent().stream().map(Order::getId).toList();
            var byId = orders.findAdminOrdersByIds(ids).stream().collect(Collectors.toMap(Order::getId, Function.identity()));
            Map<Long, String> deliveryStatus = deliveries.findStatusesByOrderIds(ids).stream()
                    .collect(Collectors.toMap(DeliveryRepository.OrderStatus::getOrderId, row -> row.getStatus().name()));
            content = ids.stream().map(id -> AdminOrderPageResponse.Summary.from(byId.get(id), deliveryStatus.get(id))).toList();
        }
        return new AdminOrderPageResponse(content, result.getNumber(), size, result.getTotalPages(), result.getTotalElements());
    }

    @Transactional(readOnly = true)
    public AdminOrderDetailResponse get(Long orderId) {
        var order = orders.findAdminOrderById(orderId).orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND));
        var payment = payments.findByOrderId(orderId).map(AdminPaymentPageResponse.Item::from).orElse(null);
        return new AdminOrderDetailResponse(AdminOrderPageResponse.Buyer.from(order.getMember()), views.view(order), payment);
    }
}
