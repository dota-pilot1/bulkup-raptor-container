package com.bulkup.raptor.order.infrastructure.mybatis;

import java.time.Instant;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface OrderHistoryMapper {
    record OrderRow(Long id, String status, long totalAmount, Instant createdAt, boolean cancellationPending, Instant reservationExpiresAt, String cancellationReason) {}
    record ItemRow(Long orderId, String productName, int quantity) {}

    long count(@Param("memberId") Long memberId, @Param("status") String status);
    List<OrderRow> findOrders(@Param("memberId") Long memberId, @Param("size") int size, @Param("offset") long offset, @Param("status") String status);
    List<ItemRow> findItems(@Param("memberId") Long memberId, @Param("ids") List<Long> ids);
}
