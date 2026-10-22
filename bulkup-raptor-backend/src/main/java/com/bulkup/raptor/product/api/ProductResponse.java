package com.bulkup.raptor.product.api;

import com.bulkup.raptor.product.domain.Product;
import com.bulkup.raptor.product.domain.ProductCategory;
import java.time.Instant;

public record ProductResponse(
    Long id,
    String name,
    String description,
    int price,
    ProductCategory category,
    String categoryLabel,
    String badge,
    String visual,
    Instant createdAt,
    Instant updatedAt
) {
    public static ProductResponse from(Product product) {
        return new ProductResponse(
            product.getId(),
            product.getName(),
            product.getDescription(),
            product.getPrice(),
            product.getCategory(),
            product.getCategory().getLabel(),
            product.getBadge(),
            product.getVisual(),
            product.getCreatedAt(),
            product.getUpdatedAt()
        );
    }
}
