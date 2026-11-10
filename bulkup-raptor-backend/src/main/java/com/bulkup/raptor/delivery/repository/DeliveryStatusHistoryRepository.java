package com.bulkup.raptor.delivery.repository;

import com.bulkup.raptor.delivery.domain.DeliveryStatusHistory;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

public interface DeliveryStatusHistoryRepository extends JpaRepository<DeliveryStatusHistory, Long> {
    @EntityGraph(attributePaths = "actor")
    List<DeliveryStatusHistory> findByDeliveryIdOrderByCreatedAtAscIdAsc(Long deliveryId);
}
