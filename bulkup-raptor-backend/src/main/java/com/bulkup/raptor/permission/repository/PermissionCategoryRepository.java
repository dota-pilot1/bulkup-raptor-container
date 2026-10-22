package com.bulkup.raptor.permission.repository;

import com.bulkup.raptor.permission.domain.PermissionCategory;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface PermissionCategoryRepository extends JpaRepository<PermissionCategory, Long> {
    List<PermissionCategory> findAllByOrderBySortOrderAscIdAsc();

    boolean existsByCode(String code);

    Optional<PermissionCategory> findByCode(String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from PermissionCategory c where c.id=:id")
    Optional<PermissionCategory> lockById(@Param("id") Long id);
}
