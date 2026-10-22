package com.bulkup.raptor.auth.domain;

import com.bulkup.raptor.role.domain.Role;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Entity
@Table(name = "members")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 254)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Column(nullable = false, length = 50)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MemberStatus status;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "member_roles",
            joinColumns = @JoinColumn(name = "member_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id"))
    private Set<Role> roles = new LinkedHashSet<>();

    @Column(nullable = false, columnDefinition = "bigint default 0")
    private long sessionVersion;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;

    @Column(name = "terms_agreed_at", nullable = false)
    private Instant termsAgreedAt;

    @Column(name = "privacy_agreed_at", nullable = false)
    private Instant privacyAgreedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    private Member(String email, String passwordHash, String name, Instant agreedAt, Role role) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.name = name;
        this.status = MemberStatus.PENDING;
        this.roles.add(Objects.requireNonNull(role));
        this.emailVerified = false;
        this.termsAgreedAt = agreedAt;
        this.privacyAgreedAt = agreedAt;
    }

    public static Member pending(
            String email, String passwordHash, String name, Instant agreedAt, Role role) {
        return new Member(email, passwordHash, name, agreedAt, role);
    }

    public void activateAfterEmailVerification() {
        this.emailVerified = true;
        this.status = MemberStatus.ACTIVE;
    }

    public void updateStatus(MemberStatus status) {
        Objects.requireNonNull(status);
        if (this.status != status) sessionVersion++;
        this.status = status;
    }

    public Set<Role> getRoles() {
        return Collections.unmodifiableSet(roles);
    }

    public boolean hasRole(String code) {
        return roles.stream().anyMatch(role -> role.getCode().equals(code));
    }

    public void changeRoles(Collection<Role> selected) {
        Objects.requireNonNull(selected);
        if (selected.isEmpty() || selected.stream().anyMatch(Objects::isNull)) {
            throw new IllegalArgumentException("At least one role is required");
        }
        var currentIds = roles.stream().map(Role::getId).collect(Collectors.toSet());
        var nextIds = selected.stream().map(Role::getId).collect(Collectors.toSet());
        if (!currentIds.equals(nextIds)) {
            roles.clear();
            roles.addAll(selected);
            sessionVersion++;
        }
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
