package com.bulkup.raptor.product.repository;

import com.bulkup.raptor.product.domain.Product;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRepository extends JpaRepository<Product, Long> {
    @Query("""
            select p from Product p
            where p.forSale = true
            order by case when p.stockQuantity > p.reservedQuantity then 0 else 1 end, p.id asc
            """)
    List<Product> findAllForCatalog();

    @Query("""
            select p from Product p
            order by case when p.stockQuantity > p.reservedQuantity then 0 else 1 end, p.id asc
            """)
    List<Product> findAllForAdmin();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Product p where p.id = :id")
    Optional<Product> findByIdForStockAdjustment(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select p from Product p where p.id in :ids order by p.id")
    List<Product> findForOrder(@Param("ids") List<Long> ids);

    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select p from Product p where p.id = :id")
    Optional<Product> findByIdForCart(@Param("id") Long id);
}
