package com.bulkup.raptor.permission.repository;

import com.bulkup.raptor.permission.domain.Permission;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.util.*;

public interface PermissionRepository extends JpaRepository<Permission, Long> {
    Optional<Permission> findByCode(String code);

    boolean existsByCode(String code);

    @EntityGraph(attributePaths = "category")
    List<Permission> findAllByOrderByIdAsc();

    @Override
    @EntityGraph(attributePaths = "category")
    Optional<Permission> findById(Long id);

    @EntityGraph(attributePaths = "category")
    @Query(
            "select p from Permission p where (:categoryId is null or p.category.id=:categoryId)"
                + " and (lower(p.name) like :q escape '!' or lower(p.code) like :q escape '!')"
                + " order by p.category.sortOrder, p.category.id, p.id")
    List<Permission> search(@Param("categoryId") Long categoryId, @Param("q") String q);

    boolean existsByCategoryId(Long categoryId);

    long countByCategoryId(Long categoryId);

    @Query(
            "select p.category.id as categoryId, count(p) as total from Permission p group by"
                + " p.category.id")
    List<CategoryCount> categoryCounts();

    interface CategoryCount {
        Long getCategoryId();

        long getTotal();
    }

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Permission e where e.id=:id")
    Optional<Permission> lockById(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Permission e where e.id in :ids order by e.id")
    List<Permission> lockAllByIds(@Param("ids") Collection<Long> ids);
}
