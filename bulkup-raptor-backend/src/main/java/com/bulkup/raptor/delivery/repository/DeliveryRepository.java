package com.bulkup.raptor.delivery.repository;

import com.bulkup.raptor.delivery.domain.Delivery;
import com.bulkup.raptor.delivery.domain.DeliveryStatus;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface DeliveryRepository extends JpaRepository<Delivery, Long>, JpaSpecificationExecutor<Delivery> {
    Optional<Delivery> findByOrderId(Long orderId);

    @Query("select d.order.id as orderId, d.status as status from Delivery d where d.order.id in :ids")
    List<OrderStatus> findStatusesByOrderIds(@Param("ids") Collection<Long> ids);

    interface OrderStatus {
        Long getOrderId();
        DeliveryStatus getStatus();
    }

    @Query("select d.order.id from Delivery d where d.id = :id")
    Optional<Long> findOrderId(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from Delivery d where d.id = :id")
    Optional<Delivery> findByIdForUpdate(@Param("id") Long id);
}
