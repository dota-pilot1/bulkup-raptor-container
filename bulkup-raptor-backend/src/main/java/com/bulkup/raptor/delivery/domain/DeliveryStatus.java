package com.bulkup.raptor.delivery.domain;

public enum DeliveryStatus {
    PREPARING, OUT_FOR_DELIVERY, DELIVERED;

    public boolean canChangeTo(DeliveryStatus next) {
        return (this == PREPARING && next == OUT_FOR_DELIVERY)
                || (this == OUT_FOR_DELIVERY && next == DELIVERED);
    }
}
