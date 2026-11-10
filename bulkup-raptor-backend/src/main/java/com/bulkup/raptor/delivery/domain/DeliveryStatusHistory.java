package com.bulkup.raptor.delivery.domain;

import com.bulkup.raptor.auth.domain.Member;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "delivery_status_history")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DeliveryStatusHistory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "delivery_id", nullable = false) private Delivery delivery;
    @Enumerated(EnumType.STRING) @Column(name = "from_status", nullable = false, length = 30) private DeliveryStatus fromStatus;
    @Enumerated(EnumType.STRING) @Column(name = "to_status", nullable = false, length = 30) private DeliveryStatus toStatus;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "actor_id") private Member actor;
    @Column(length = 500) private String reason;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    public static DeliveryStatusHistory record(Delivery delivery, DeliveryStatus from, Member actor, String reason, Instant now) {
        var history = new DeliveryStatusHistory();
        history.delivery = delivery;
        history.fromStatus = from;
        history.toStatus = delivery.getStatus();
        history.actor = actor;
        history.reason = reason;
        history.createdAt = now;
        return history;
    }
}
