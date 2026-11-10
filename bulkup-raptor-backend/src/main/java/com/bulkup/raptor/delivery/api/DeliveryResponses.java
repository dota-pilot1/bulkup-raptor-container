package com.bulkup.raptor.delivery.api;

import com.bulkup.raptor.delivery.domain.*;
import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.order.domain.Order;
import java.time.Instant;
import java.util.List;

public final class DeliveryResponses {
    private DeliveryResponses() {}

    public record Item(String productName, int quantity) {}
    public record Info(Long deliveryId, Long orderId, DeliveryStatus status, long version,
            String recipientName, String phone, String postalCode, String address, String addressDetail,
            String centerName, String pickupLocation, Instant scheduledAt,
            Instant createdAt, Instant startedAt, Instant deliveredAt, List<Item> items, String handlerName) {
        public static Info from(Delivery d, Member handler) {
            return new Info(d.getId(), d.getOrder().getId(), d.getStatus(), d.getVersion(),
                    d.getRecipientName(), d.getPhone(), d.getPostalCode(), d.getAddress(), d.getAddressDetail(),
                    d.getCenterName(), d.getPickupLocation(), d.getScheduledAt(),
                    d.getCreatedAt(), d.getStartedAt(), d.getDeliveredAt(), DeliveryResponses.items(d.getOrder()),
                    handler == null ? null : handler.getName());
        }
    }
    public record Summary(Long deliveryId, Long orderId, DeliveryStatus status, long version,
            String recipientName, Instant createdAt, Instant startedAt, Instant deliveredAt, List<Item> items) {
        public static Summary from(Delivery d) {
            return new Summary(d.getId(), d.getOrder().getId(), d.getStatus(), d.getVersion(),
                    d.getRecipientName(), d.getCreatedAt(), d.getStartedAt(), d.getDeliveredAt(), DeliveryResponses.items(d.getOrder()));
        }
    }
    public record AdminHistory(Long id, DeliveryStatus fromStatus, DeliveryStatus toStatus,
            Long actorId, String actorName, String reason, Instant createdAt) {
        public static AdminHistory from(DeliveryStatusHistory h) {
            return new AdminHistory(h.getId(), h.getFromStatus(), h.getToStatus(),
                    h.getActor() == null ? null : h.getActor().getId(),
                    h.getActor() == null ? null : h.getActor().getName(), h.getReason(), h.getCreatedAt());
        }
    }
    public record PublicHistory(DeliveryStatus fromStatus, DeliveryStatus toStatus, Instant createdAt) {
        public static PublicHistory from(DeliveryStatusHistory h) {
            return new PublicHistory(h.getFromStatus(), h.getToStatus(), h.getCreatedAt());
        }
    }
    public record AdminDetail(Info delivery, List<AdminHistory> history) {}
    public record CustomerDetail(Info delivery, List<PublicHistory> history) {}
    public record Page(List<Summary> content, int page, int size, int totalPages, long totalElements) {}

    private static List<Item> items(Order order) {
        return order.getItems().stream().map(i -> new Item(i.getProductName(), i.getQuantity())).toList();
    }
}
