package com.bulkup.raptor.role.repository;

import com.bulkup.raptor.role.domain.*;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface RolePermissionRepository extends JpaRepository<RolePermission, RolePermissionId> {
    @Query(
            "select rp from RolePermission rp join fetch rp.permission p join fetch p.category join"
                    + " fetch rp.role where rp.role.id in :ids order by rp.permission.id")
    List<RolePermission> findLinks(@Param("ids") Collection<Long> ids);

    @Query(
            "select rp.permission.code from RolePermission rp where rp.role.id=:id order by"
                    + " rp.permission.code")
    List<String> findCodes(@Param("id") Long id);

    @Query(
            "select distinct rp.permission.code from RolePermission rp where rp.role.id in :ids"
                    + " order by rp.permission.code")
    List<String> findCodesForRoles(@Param("ids") Collection<Long> ids);

    @Query(
            "select distinct p from RolePermission rp join rp.permission p join fetch p.category"
                    + " where rp.role.id in :ids order by p.code")
    List<com.bulkup.raptor.permission.domain.Permission> findPermissionsForRoles(
            @Param("ids") Collection<Long> ids);

    @Query(
            "select rp from RolePermission rp join fetch rp.role where rp.permission.id=:id order"
                    + " by rp.role.id")
    List<RolePermission> findPermissionRoles(@Param("id") Long id);

    @Query(
            "select rp from RolePermission rp join fetch rp.role join fetch rp.permission where"
                    + " rp.permission.id in :ids order by rp.role.id")
    List<RolePermission> findPermissionLinks(@Param("ids") Collection<Long> ids);

    @Query(
            "select rp.permission.id as permissionId,count(rp) as total from RolePermission rp"
                    + " group by rp.permission.id")
    List<PermissionRoleCount> permissionRoleCounts();

    interface PermissionRoleCount {
        Long getPermissionId();

        long getTotal();
    }

    boolean existsByPermissionId(Long permissionId);

    long countByPermissionId(Long permissionId);

    @Modifying(flushAutomatically = true)
    @Query("delete from RolePermission rp where rp.role.id=:id")
    void deleteLinks(@Param("id") Long id);
}
