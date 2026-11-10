package com.bulkup.raptor.delivery.api;

import java.util.List;

public record StartDeliveriesResponse(List<Item> results) {
    public record Item(Long orderId, boolean succeeded, String deliveryStatus, String code, String message) {}
}
