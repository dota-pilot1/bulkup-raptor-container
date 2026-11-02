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

    private Product(String name, String description, int price, ProductCategory category, String badge, String visual) {
        this.name = name;
        this.description = description;
        this.price = price;
        this.category = category;
        this.badge = badge;
        this.visual = visual;
    }

    public static Product create(String name, String description, int price, ProductCategory category, String badge, String visual) {
        return new Product(name, description, price, category, badge, visual);
    }

    public void change(String name, String description, int price, ProductCategory category, String badge, String visual) {
        this.name = name;
        this.description = description;
        this.price = price;
        this.category = category;
        this.badge = badge;
        this.visual = visual;
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
