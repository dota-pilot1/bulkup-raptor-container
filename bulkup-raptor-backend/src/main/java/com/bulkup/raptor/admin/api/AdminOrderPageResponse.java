package com.bulkup.raptor.admin.api;

import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.order.domain.Order;
import com.bulkup.raptor.order.api.OrderPageResponse;
import java.time.Instant;
import java.util.List;

public record AdminOrderPageResponse(List<Summary> content, int page, int size, int totalPages, long totalElements) {
    public record Buyer(Long memberId, String name, String email) {
        public static Buyer from(Member member) {
            return new Buyer(member.getId(), member.getName(), member.getEmail());
        }
    }

    public record Summary(Long orderId, Buyer buyer, String status, List<OrderPageResponse.Item> items,
            long totalAmount, Instant createdAt, boolean cancellationPending, String deliveryStatus, String cancellationReason) {
        public static Summary from(Order order, String deliveryStatus) {
            return new Summary(order.getId(), Buyer.from(order.getMember()), order.getStatus(),
                    order.getItems().stream().map(item -> new OrderPageResponse.Item(item.getProductName(), item.getQuantity())).toList(),
                    order.getTotalAmount(), order.getCreatedAt(), order.isPaidCancellationPending(), deliveryStatus,
                    order.getCancellationReason());
        }
    }
}
