package com.bulkup.raptor.cart.api;

import com.bulkup.raptor.cart.domain.CartItem;
import java.util.List;

public record CartResponse(List<CartItemResponse> items, long totalQuantity, long totalAmount) {
    public static CartResponse from(List<CartItem> items) {
        var responses = items.stream().map(CartItemResponse::from).toList();
        return new CartResponse(responses,
                responses.stream().mapToLong(CartItemResponse::quantity).sum(),
                responses.stream().mapToLong(CartItemResponse::lineTotal).sum());
    }
}
