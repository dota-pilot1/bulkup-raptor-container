package com.bulkup.raptor.order.api;

import com.bulkup.raptor.order.domain.Order;
import com.bulkup.raptor.order.domain.OrderItem;
import java.time.Instant;
import java.util.List;

public record OrderResponse(Long orderId, String status, List<Item> items,
        long itemsTotal, long shippingFee, long totalAmount, Delivery delivery, Instant createdAt, boolean cancellationPending, String inventoryStatus, String deliveryStatus, String cancellationReason, Instant reservationExpiresAt) {
    public record Item(Long productId, String productName, long unitPrice, int quantity, long lineTotal) {
        static Item from(OrderItem item) {
            return new Item(item.getProductId(), item.getProductName(), item.getUnitPrice(),
                    item.getQuantity(), item.getLineTotal());
        }
    }
    public record Delivery(String recipientName, String phone, String postalCode,
            String address, String addressDetail) {}
    public static OrderResponse from(Order order) { return from(order, false, "NOT_RESERVED"); }

    public static OrderResponse from(Order order, boolean cancellationPending, String inventoryStatus) {
        return from(order, cancellationPending, inventoryStatus, null);
    }

    public static OrderResponse from(Order order, boolean cancellationPending, String inventoryStatus, String deliveryStatus) {
        return from(order, cancellationPending, inventoryStatus, deliveryStatus, null);
    }

    public static OrderResponse from(Order order, boolean cancellationPending, String inventoryStatus, String deliveryStatus, Instant reservationExpiresAt) {
        return new OrderResponse(order.getId(), order.getStatus(),
                order.getItems().stream().map(Item::from).toList(), order.getItemsTotal(),
                order.getShippingFee(), order.getTotalAmount(),
                new Delivery(order.getRecipientName(), order.getPhone(), order.getPostalCode(),
                        order.getAddress(), order.getAddressDetail()), order.getCreatedAt(), cancellationPending, inventoryStatus, deliveryStatus, order.getCancellationReason(), reservationExpiresAt);
    }
}
