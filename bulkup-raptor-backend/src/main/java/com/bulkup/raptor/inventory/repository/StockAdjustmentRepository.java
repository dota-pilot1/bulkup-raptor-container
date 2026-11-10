package com.bulkup.raptor.inventory.repository;

import com.bulkup.raptor.inventory.domain.StockAdjustment;
import org.springframework.data.jpa.repository.JpaRepository;

// 이력 저장에 사용한다. 목록 조회는 StockAdjustmentQueryMapper에서 처리한다.
public interface StockAdjustmentRepository extends JpaRepository<StockAdjustment, Long> {}
