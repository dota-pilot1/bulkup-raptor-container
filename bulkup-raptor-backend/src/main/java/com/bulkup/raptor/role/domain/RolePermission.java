package com.bulkup.raptor.role.domain;

import com.bulkup.raptor.permission.domain.Permission;

import jakarta.persistence.*;

import lombok.*;

@Entity
@Table(name = "role_permissions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RolePermission {
    @EmbeddedId private RolePermissionId id;

    @MapsId("roleId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "role_id")
    private Role role;

    @MapsId("permissionId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "permission_id")
    private Permission permission;

    public RolePermission(Role role, Permission permission) {
        this.role = role;
        this.permission = permission;
        this.id = new RolePermissionId(role.getId(), permission.getId());
    }
}
