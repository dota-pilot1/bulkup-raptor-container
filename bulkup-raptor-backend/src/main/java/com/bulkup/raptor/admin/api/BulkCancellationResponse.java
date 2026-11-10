package com.bulkup.raptor.admin.api;

import java.util.List;

public record BulkCancellationResponse(List<Item> results) {
    public record Item(Long orderId, boolean succeeded, String orderStatus, Boolean pending, String code, String message) {}
}
