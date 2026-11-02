package com.bulkup.raptor.cart.api;

import com.bulkup.raptor.cart.application.service.CartService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
public class CartController {
    private final CartService carts;

    @GetMapping
    public CartResponse get(@AuthenticationPrincipal Long memberId) {
        return carts.get(memberId);
    }

    @PostMapping("/items")
    public CartResponse add(@AuthenticationPrincipal Long memberId,
                            @Valid @RequestBody AddCartItemRequest request) {
        return carts.add(memberId, request.productId(), request.quantity().intValueExact());
    }

    @PatchMapping("/items/{itemId}")
    public CartResponse changeQuantity(@AuthenticationPrincipal Long memberId,
                                      @PathVariable Long itemId,
                                      @Valid @RequestBody UpdateCartItemQuantityRequest request) {
        return carts.changeQuantity(memberId, itemId, request.quantity().intValueExact());
    }

    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Long memberId, @PathVariable Long itemId) {
        carts.delete(memberId, itemId);
        return ResponseEntity.noContent().build();
    }
}
