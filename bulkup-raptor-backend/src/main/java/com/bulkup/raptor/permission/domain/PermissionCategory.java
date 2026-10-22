package com.bulkup.raptor.permission.domain;

import jakarta.persistence.*;

import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "permission_categories")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PermissionCategory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String code;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(nullable = false, length = 500)
    private String description;

    @Column(nullable = false)
    private int sortOrder;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    public static PermissionCategory create(
            String code, String name, String description, int sortOrder) {
        var category = new PermissionCategory();
        category.code = code;
        category.update(name, description, sortOrder);
        return category;
    }

    public void update(String name, String description, int sortOrder) {
        this.name = name.trim();
        this.description = description == null ? "" : description.trim();
        this.sortOrder = sortOrder;
    }

    @PrePersist
    void created() {
        createdAt = Instant.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void updated() {
        updatedAt = Instant.now();
    }
}
