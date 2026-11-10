package com.bulkup.raptor.admin.api;

import com.bulkup.raptor.order.api.OrderResponse;

public record AdminOrderDetailResponse(AdminOrderPageResponse.Buyer buyer, OrderResponse order,
        AdminPaymentPageResponse.Item payment) {}
