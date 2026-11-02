package com.bulkup.raptor.order.repository;

import com.bulkup.raptor.order.domain.Order;
import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderRepository extends JpaRepository<Order, Long> {
    @EntityGraph(attributePaths = "items")
    Optional<Order> findByMemberIdAndRequestId(Long memberId, UUID requestId);
    @EntityGraph(attributePaths = "items")
    Optional<Order> findByIdAndMemberId(Long id, Long memberId);

    // 컬렉션을 조인하지 않고 주문 행만 잠근다. 상품 스냅샷은 트랜잭션 안에서 읽는다.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from Order o where o.id = :id and o.member.id = :memberId")
    Optional<Order> findByIdAndMemberIdForUpdate(@Param("id") Long id, @Param("memberId") Long memberId);
}
