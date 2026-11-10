package com.bulkup.raptor.cart.application.service;

import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.domain.MemberStatus;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.cart.api.CartResponse;
import com.bulkup.raptor.cart.domain.CartItem;
import com.bulkup.raptor.cart.repository.CartItemRepository;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.product.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CartService {
    private final CartItemRepository items;
    private final MemberRepository members;
    private final ProductRepository products;

    @Transactional(readOnly = true)
    public CartResponse get(Long memberId) {
        requireMemberId(memberId);
        return response(memberId);
    }

    @Transactional
    public CartResponse add(Long memberId, Long productId, int quantity) {
        // 같은 회원의 변경 요청을 DB에서 직렬화해 신규 항목 중복과 수량 유실을 막는다.
        Member member = lockMember(memberId);
        // 담기 처리 중 상품이 삭제되거나 가격이 바뀌지 않도록 상품 행도 잠근다.
        var product = products.findByIdForCart(productId)
                .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND));
        if (!product.isForSale()) throw new BusinessException(ErrorCode.PRODUCT_NOT_FOR_SALE);
        var existing = items.findByMemberIdAndProductId(memberId, productId);
        if (existing.isPresent()) {
            existing.get().increaseQuantity(quantity);
        } else {
            items.save(CartItem.create(member, product, quantity));
        }
        items.flush();
        return response(memberId);
    }

    @Transactional
    public CartResponse changeQuantity(Long memberId, Long itemId, int quantity) {
        // 회원 객체 대신 회원 행 잠금과 상태 확인이 목적이므로 반환값은 사용하지 않는다.
        // 잠금은 이 트랜잭션이 끝날 때까지 유지한다.
        lockMember(memberId);

        // 객체의 수량을 검증하고 변경한다. ownedItem 의 리턴 타입은 CartItem
        ownedItem(memberId, itemId).changeQuantity(quantity);

        // flush()가 호출되면 영속 상태인 cartItem의 더티 체킹을 통해 변경 사항이 자동으로 SQL UPDATE로 생성되어 DB에 반영된다. 커밋은 트랜잭션 종료 시 처리된다.
        items.flush();

        return response(memberId);
    }

    @Transactional
    public void delete(Long memberId, Long itemId) {
        lockMember(memberId);
        items.delete(ownedItem(memberId, itemId));
        items.flush();
    }

    private CartItem ownedItem(Long memberId, Long itemId) {
        // 타 회원 항목도 404로 처리해 항목 존재 여부를 노출하지 않는다.
        return items.findByIdAndMemberId(itemId, memberId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CART_ITEM_NOT_FOUND));
    }

    /**
     * 회원을 조회하면서 회원 행의 쓰기 잠금을 확보하고 활성 상태를 확인한다.
     * 같은 회원의 장바구니 변경 요청은 이 잠금을 통해 순서대로 처리한다.
     * 반환한 회원은 새 장바구니 항목을 생성할 때 사용한다.
     */
    private Member lockMember(Long memberId) {
        requireMemberId(memberId);
        // findByIdForUpdate의 @Lock(PESSIMISTIC_WRITE) 설정이 조회에 잠금을 적용한다.
        Member member = members.findByIdForUpdate(memberId)
                .orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_REQUIRED));
        if (member.getStatus() != MemberStatus.ACTIVE) {
            throw new BusinessException(ErrorCode.MEMBER_SUSPENDED);
        }
        return member;
    }

    private void requireMemberId(Long memberId) {
        if (memberId == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
    }

    private CartResponse response(Long memberId) {
        return CartResponse.from(items.findCartItems(memberId));
    }
}
