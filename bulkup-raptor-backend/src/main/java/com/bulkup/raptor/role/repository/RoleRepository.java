package com.bulkup.raptor.role.repository;

import com.bulkup.raptor.role.domain.Role;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface RoleRepository extends JpaRepository<Role, Long> {
    Optional<Role> findByCode(String code);

    boolean existsByCode(String code);

    List<Role> findAllByOrderByIdAsc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Role e where e.id=:id")
    Optional<Role> lockById(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Role e where e.id in :ids order by e.id")
    List<Role> lockAllByIds(@Param("ids") Collection<Long> ids);
}
