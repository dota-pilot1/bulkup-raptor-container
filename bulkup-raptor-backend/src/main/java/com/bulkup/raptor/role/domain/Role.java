package com.bulkup.raptor.role.domain;

import jakarta.persistence.*;

import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "roles")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Role {
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
    private boolean systemRole;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @Column(nullable = false)
    private long permissionVersion;

    public void permissionsChanged() {
        permissionVersion++;
    }

    public static Role create(String code, String name, String description) {
        var entity = new Role();
        entity.code = code;
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
