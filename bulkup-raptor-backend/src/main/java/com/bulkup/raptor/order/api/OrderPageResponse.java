package com.bulkup.raptor.order.api;

import com.bulkup.raptor.order.domain.Order;
import java.time.Instant;
import java.util.List;

public record OrderPageResponse(List<Summary> content, int page, int totalPages, long totalElements) {
    public record Item(String productName, int quantity) {}
    public record Summary(Long orderId, String status, List<Item> items, long totalAmount, Instant createdAt, boolean cancellationPending) {
        public static Summary from(Order order) {
            return new Summary(order.getId(), order.getStatus(), order.getItems().stream()
                    .map(item -> new Item(item.getProductName(), item.getQuantity())).toList(),
                    order.getTotalAmount(), order.getCreatedAt(), false);
        }
    }
}
