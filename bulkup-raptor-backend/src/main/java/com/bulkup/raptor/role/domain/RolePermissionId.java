package com.bulkup.raptor.role.domain;

import jakarta.persistence.Embeddable;

import lombok.*;

import java.io.Serializable;

@Embeddable
@Getter
@EqualsAndHashCode
@NoArgsConstructor
@AllArgsConstructor
public class RolePermissionId implements Serializable {
    private Long roleId;
    private Long permissionId;
}
