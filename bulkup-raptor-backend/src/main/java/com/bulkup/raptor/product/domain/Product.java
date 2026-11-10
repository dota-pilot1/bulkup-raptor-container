package com.bulkup.raptor.product.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import com.bulkup.raptor.image.domain.UploadedImage;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "products")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(nullable = false, length = 200)
    private String description;

    @Column(nullable = false)
    private int price;

    @Column(name = "stock_quantity", nullable = false)
    private int stockQuantity;

    @Column(name = "reserved_quantity", nullable = false)
    private int reservedQuantity;

    @Column(name = "for_sale", nullable = false)
    private boolean forSale = true;

    public int getAvailableQuantity() { return stockQuantity - reservedQuantity; }

    public void reserveStock(int quantity) {
        if (quantity <= 0) throw new BusinessException(ErrorCode.INVALID_INPUT);
        if (quantity > getAvailableQuantity()) throw new BusinessException(ErrorCode.STOCK_INSUFFICIENT);
        reservedQuantity += quantity;
    }

    public void confirmStock(int quantity) {
        requireReserved(quantity);
        stockQuantity -= quantity;
        reservedQuantity -= quantity;
    }

    public void releaseStock(int quantity) {
        requireReserved(quantity);
        reservedQuantity -= quantity;
    }

    private void requireReserved(int quantity) {
        if (quantity <= 0 || quantity > reservedQuantity)
            throw new BusinessException(ErrorCode.STOCK_RESERVATION_CONFLICT);
    }

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProductCategory category;

    @Column(length = 12)
    private String badge;

    @Column(nullable = false, length = 16)
    private String visual;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "image_key")
    private UploadedImage image;

    public void attachImage(UploadedImage image) {
        this.image = image;
    }

    public String getImageUrl() {
        return image == null ? null : image.getUrl();
    }

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    private Product(String name, String description, int price, ProductCategory category, String badge, String visual,
            int stockQuantity) {
        if (stockQuantity < 0) {
            throw new IllegalArgumentException("재고 수량은 0 이상이어야 합니다.");
        }
        this.name = name;
        this.description = description;
        this.price = price;
        this.category = category;
        this.badge = badge;
        this.visual = visual;
        this.stockQuantity = stockQuantity;
        this.forSale = true;
    }

    public void setForSale(boolean forSale) {
        this.forSale = forSale;
    }

    public static Product create(String name, String description, int price, ProductCategory category, String badge, String visual) {
        // 기존 시드와 내부 생성 경로는 초기 재고 0을 사용한다.
        return create(name, description, price, category, badge, visual, 0);
    }

    public static Product create(String name, String description, int price, ProductCategory category, String badge,
            String visual, int stockQuantity) {
        return new Product(name, description, price, category, badge, visual, stockQuantity);
    }

    public void change(String name, String description, int price, ProductCategory category, String badge, String visual) {
        this.name = name;
        this.description = description;
        this.price = price;
        this.category = category;
        this.badge = badge;
        this.visual = visual;
    }

    public void adjustStock(int delta) {
        if (delta == 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT);
        }
        long afterQuantity = (long) stockQuantity + delta;
        if (afterQuantity < reservedQuantity) {
            throw new BusinessException(ErrorCode.STOCK_INSUFFICIENT);
        }
        if (afterQuantity > Integer.MAX_VALUE) {
            throw new BusinessException(ErrorCode.STOCK_QUANTITY_OUT_OF_RANGE);
        }
        stockQuantity = (int) afterQuantity;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
