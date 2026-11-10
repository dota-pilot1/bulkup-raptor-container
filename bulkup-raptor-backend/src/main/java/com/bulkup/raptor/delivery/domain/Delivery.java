package com.bulkup.raptor.delivery.domain;

import com.bulkup.raptor.order.domain.Order;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "deliveries", uniqueConstraints = @UniqueConstraint(name = "uk_deliveries_order", columnNames = "order_id"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Delivery {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false) private Order order;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30) private DeliveryStatus status;
    @Version private long version;
    @Column(name = "recipient_name", nullable = false, length = 80) private String recipientName;
    @Column(nullable = false, length = 30) private String phone;
    @Column(name = "postal_code", nullable = false, length = 10) private String postalCode;
    @Column(nullable = false, length = 200) private String address;
    @Column(name = "address_detail", nullable = false, length = 200) private String addressDetail;
    @Column(name = "center_name", length = 200) private String centerName;
    @Column(name = "pickup_location", length = 200) private String pickupLocation;
    @Column(name = "scheduled_at") private Instant scheduledAt;
    @Column(name = "started_at") private Instant startedAt;
    @Column(name = "delivered_at") private Instant deliveredAt;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    public static Delivery prepare(Order order) {
        if (!"PAID".equals(order.getStatus())) throw new BusinessException(ErrorCode.DELIVERY_ORDER_NOT_PAID);
        var delivery = new Delivery();
        delivery.order = order;
        delivery.status = DeliveryStatus.PREPARING;
        delivery.recipientName = order.getRecipientName();
        delivery.phone = order.getPhone();
        delivery.postalCode = order.getPostalCode();
        delivery.address = order.getAddress();
        delivery.addressDetail = order.getAddressDetail();
        delivery.createdAt = Instant.now();
        return delivery;
    }

    public void changeStatus(DeliveryStatus next, Instant now) {
        if (!status.canChangeTo(next)) throw new BusinessException(ErrorCode.DELIVERY_STATUS_CONFLICT);
        status = next;
        if (next == DeliveryStatus.OUT_FOR_DELIVERY) startedAt = now;
        if (next == DeliveryStatus.DELIVERED) deliveredAt = now;
    }
}
