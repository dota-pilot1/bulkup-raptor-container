package com.bulkup.raptor.inventory.repository;

import com.bulkup.raptor.inventory.domain.StockReservation;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StockReservationRepository extends JpaRepository<StockReservation, Long> {
    // The owning order is locked before reading or changing reservations.
    List<StockReservation> findByOrderIdOrderByProductIdAsc(Long orderId);

    @Query(value = """
            SELECT order_id FROM stock_reservations
            WHERE status IN ('RESERVED', 'RELEASE_PENDING', 'REVIEW_REQUIRED') AND next_check_at <= :now
            GROUP BY order_id ORDER BY min(next_check_at), order_id LIMIT 100
            """, nativeQuery = true)
    List<Long> findDueOrderIds(@Param("now") Instant now);
}
