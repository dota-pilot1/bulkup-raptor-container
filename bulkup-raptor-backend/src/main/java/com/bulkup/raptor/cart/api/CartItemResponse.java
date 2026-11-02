package com.bulkup.raptor.cart.api;

import com.bulkup.raptor.cart.domain.CartItem;
import com.bulkup.raptor.product.api.ProductResponse;

public record CartItemResponse(Long id, ProductResponse product, int quantity, long lineTotal) {
    public static CartItemResponse from(CartItem item) {
        return new CartItemResponse(item.getId(), ProductResponse.from(item.getProduct()),
                item.getQuantity(), (long) item.getProduct().getPrice() * item.getQuantity());
    }
}
