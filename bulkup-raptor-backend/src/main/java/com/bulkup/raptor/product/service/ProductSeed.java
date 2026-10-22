package com.bulkup.raptor.product.service;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ProductSeed {

    private final ProductService productService;

    @EventListener(ApplicationReadyEvent.class)
    public void seed() {
        productService.seedIfEmpty();
    }
}
