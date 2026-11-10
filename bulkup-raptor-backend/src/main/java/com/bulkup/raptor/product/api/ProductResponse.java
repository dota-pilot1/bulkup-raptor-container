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
    String imageUrl,
    int stockQuantity,
    int reservedQuantity,
    int availableQuantity,
    boolean forSale,
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
            product.getImageUrl(),
            product.getStockQuantity(),
            product.getReservedQuantity(),
            product.getAvailableQuantity(),
            product.isForSale(),
            product.getCreatedAt(),
            product.getUpdatedAt()
        );
    }
}
