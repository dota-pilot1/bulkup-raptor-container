package com.bulkup.raptor.cart.repository;

import com.bulkup.raptor.cart.domain.CartItem;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CartItemRepository extends JpaRepository<CartItem, Long> {
    @EntityGraph(attributePaths = {"product", "product.image"})
    @Query("""
            select item from CartItem item
            where item.member.id = :memberId
            order by item.id asc
            """)
    List<CartItem> findCartItems(@Param("memberId") Long memberId);

    @Query("select item from CartItem item where item.member.id = :memberId and item.id in :ids order by item.id")
    List<CartItem> findForOrder(@Param("memberId") Long memberId, @Param("ids") List<Long> ids);

    Optional<CartItem> findByMemberIdAndProductId(Long memberId, Long productId);

    Optional<CartItem> findByIdAndMemberId(Long id, Long memberId);
}
