package com.bulkup.raptor.inventory.infrastructure.mybatis;

import com.bulkup.raptor.inventory.application.model.StockAdjustmentRow;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface StockAdjustmentQueryMapper {
    boolean existsProduct(@Param("productId") Long productId);

    long countByProductId(@Param("productId") Long productId);

    List<StockAdjustmentRow> findByProductId(@Param("productId") Long productId,
            @Param("size") int size, @Param("offset") long offset);
}
