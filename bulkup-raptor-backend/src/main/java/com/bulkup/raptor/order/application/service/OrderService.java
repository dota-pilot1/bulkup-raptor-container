package com.bulkup.raptor.order.application.service;

import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.domain.MemberStatus;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.cart.repository.CartItemRepository;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.order.api.CreateOrderRequest;
import com.bulkup.raptor.order.api.OrderResponse;
import com.bulkup.raptor.order.api.OrderPageResponse;
import com.bulkup.raptor.order.infrastructure.mybatis.OrderHistoryMapper;
import com.bulkup.raptor.order.domain.Order;
import com.bulkup.raptor.order.repository.OrderRepository;
import com.bulkup.raptor.product.repository.ProductRepository;
import java.io.*;
import java.security.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class OrderService {
    private final MemberRepository members;
    private final CartItemRepository cartItems;
    private final ProductRepository products;
    private final OrderRepository orders;
    private final OrderHistoryMapper history;
    private final com.bulkup.raptor.payment.repository.PaymentRepository payments;
    private final com.bulkup.raptor.delivery.repository.DeliveryRepository deliveries;
    private final com.bulkup.raptor.inventory.application.service.StockReservationService stock;

    public record Creation(OrderResponse order, boolean created) {}

    @Transactional
    public Creation create(Long memberId, CreateOrderRequest request) {
        Member member = lockMember(memberId);
        var ids = request.cartItemIds().stream().sorted().toList();
        if (new HashSet<>(ids).size() != ids.size()) throw new BusinessException(ErrorCode.INVALID_INPUT);
        String fingerprint = fingerprint(request, ids);
        // 재시도는 삭제된 장바구니 검증보다 저장된 주문 확인을 먼저 수행한다.
        var existing = orders.findByMemberIdAndRequestId(memberId, request.requestId());
        if (existing.isPresent()) {
            if (!existing.get().getRequestFingerprint().equals(fingerprint))
                throw new BusinessException(ErrorCode.ORDER_REQUEST_CONFLICT);
            return new Creation(response(existing.get()), false);
        }

        // 상품 가격은 상품 행을 잠그는 조회에서 가져온다.
        var selected = cartItems.findForOrder(memberId, ids);
        if (selected.size() != ids.size()) throw new BusinessException(ErrorCode.CART_ITEM_NOT_FOUND);
        var productIds = selected.stream().map(i -> i.getProduct().getId()).distinct().sorted().toList();
        var lockedProducts = products.findForOrder(productIds);
        if (lockedProducts.size() != productIds.size()) throw new BusinessException(ErrorCode.PRODUCT_NOT_FOUND);
        var byId = new HashMap<Long, com.bulkup.raptor.product.domain.Product>();
        lockedProducts.forEach(product -> byId.put(product.getId(), product));
        // 주문 생성에서는 현재 판매 가능 수량만 검사한다. 예약은 결제 준비에서 수행한다.
        var quantities = new TreeMap<Long, Integer>();
        for (var item : selected)
            quantities.merge(item.getProduct().getId(), item.getQuantity(), Math::addExact);
        for (var entry : quantities.entrySet()) {
            if (entry.getValue() > byId.get(entry.getKey()).getAvailableQuantity())
                throw new BusinessException(ErrorCode.ORDER_STOCK_INSUFFICIENT);
        }
        var order = Order.create(member, request.requestId(), fingerprint, request.recipientName().trim(),
                request.phone().trim(), request.postalCode().trim(), request.address().trim(), request.addressDetail().trim());
        for (var item : selected) order.addItem(byId.get(item.getProduct().getId()), item.getQuantity());
        order.calculateShipping();
        if (order.getTotalAmount() != request.expectedTotalAmount().longValueExact())
            throw new BusinessException(ErrorCode.ORDER_AMOUNT_CHANGED);
        orders.saveAndFlush(order);
        cartItems.deleteAll(selected);
        cartItems.flush();
        return new Creation(response(order), true);
    }

    @Transactional(readOnly = true)
    public OrderResponse get(Long memberId, Long orderId) {
        if (memberId == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
        return response(orders.findByIdAndMemberId(orderId, memberId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ORDER_NOT_FOUND)));
    }

    @Transactional(readOnly = true)
    public OrderPageResponse list(Long memberId, int page, int size, String status) {
        if (memberId == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
        if (page < 0 || size < 1 || size > 50) throw new BusinessException(ErrorCode.INVALID_INPUT);
        if (status != null && !Set.of("CREATED", "PAID", "CANCELLED").contains(status))
            throw new BusinessException(ErrorCode.INVALID_INPUT);
        long total = history.count(memberId, status);
        var rows = history.findOrders(memberId, size, (long) page * size, status);
        var items = new HashMap<Long, List<OrderPageResponse.Item>>();
        if (!rows.isEmpty()) {
            var ids = rows.stream().map(OrderHistoryMapper.OrderRow::id).toList();
            for (var item : history.findItems(memberId, ids)) {
                items.computeIfAbsent(item.orderId(), ignored -> new ArrayList<>())
                        .add(new OrderPageResponse.Item(item.productName(), item.quantity()));
            }
        }
        var content = rows.stream().map(row -> new OrderPageResponse.Summary(row.id(), row.status(),
                items.getOrDefault(row.id(), List.of()), row.totalAmount(), row.createdAt(), row.cancellationPending())).toList();
        long pages = total / size + (total % size == 0 ? 0 : 1);
        return new OrderPageResponse(content, page, (int) Math.min(pages, Integer.MAX_VALUE), total);
    }

    public OrderResponse view(Order order) {
        return response(order);
    }

    private OrderResponse response(Order order) {
        String inventoryStatus = stock.snapshot(order).status();
        boolean pending = order.isPaidCancellationPending() || ("CREATED".equals(order.getStatus())
                && Set.of("RELEASE_PENDING", "REVIEW_REQUIRED").contains(inventoryStatus)
                && payments.findByOrderId(order.getId()).map(p -> !p.isKeepOrderOnRelease()).orElse(false));
        String deliveryStatus = deliveries.findByOrderId(order.getId()).map(d -> d.getStatus().name()).orElse(null);
        return OrderResponse.from(order, pending, inventoryStatus, deliveryStatus);
    }

    private Member lockMember(Long memberId) {
        if (memberId == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
        var member = members.findByIdForUpdate(memberId)
                .orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_REQUIRED));
        if (member.getStatus() != MemberStatus.ACTIVE) throw new BusinessException(ErrorCode.MEMBER_SUSPENDED);
        return member;
    }

    private String fingerprint(CreateOrderRequest request, List<Long> ids) {
        try {
            var buffer = new ByteArrayOutputStream();
            try (var data = new DataOutputStream(buffer)) {
                data.writeInt(ids.size());
                for (long id : ids) data.writeLong(id);
                for (String value : List.of(request.recipientName(), request.phone(), request.postalCode(),
                        request.address(), request.addressDetail())) data.writeUTF(value.trim());
                data.writeLong(request.expectedTotalAmount().longValueExact());
            }
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(buffer.toByteArray()));
        } catch (IOException | NoSuchAlgorithmException exception) {
            throw new IllegalStateException("Cannot fingerprint order request", exception);
        }
    }
}
