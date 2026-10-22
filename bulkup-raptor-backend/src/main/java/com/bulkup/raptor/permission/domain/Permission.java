package com.bulkup.raptor.permission.domain;

import jakarta.persistence.*;

import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "permissions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Permission {
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
    private boolean systemPermission;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private PermissionCategory category;

    public void moveTo(PermissionCategory category) {
        this.category = category;
    }

    public static Permission create(
            String code, String name, String description, PermissionCategory category) {
        var entity = new Permission();
        entity.code = code;
        entity.category = category;
        entity.rename(name, description);
        return entity;
    }

    public void rename(String name, String description) {
        this.name = name.trim();
        this.description = description == null ? "" : description.trim();
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
