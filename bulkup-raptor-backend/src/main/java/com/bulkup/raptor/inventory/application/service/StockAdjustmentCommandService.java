package com.bulkup.raptor.inventory.application.service;

import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.inventory.api.StockAdjustmentRequest;
import com.bulkup.raptor.inventory.api.StockAdjustmentResponse;
import com.bulkup.raptor.inventory.domain.StockAdjustment;
import com.bulkup.raptor.inventory.repository.StockAdjustmentRepository;
import com.bulkup.raptor.product.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class StockAdjustmentCommandService {
    private final ProductRepository products;
    private final MemberRepository members;
    private final StockAdjustmentRepository adjustments;

    @Transactional
    public StockAdjustmentResponse create(Long productId, Long memberId, StockAdjustmentRequest request) {
        if (memberId == null) {
            throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
        }
        if (request == null || request.delta() == null || request.delta() == 0
                || request.reason() == null || request.reason().isBlank() || request.reason().length() > 200) {
            throw new BusinessException(ErrorCode.INVALID_INPUT);
        }
        var actor = members.findById(memberId)
                .orElseThrow(() -> new BusinessException(ErrorCode.MEMBER_NOT_FOUND));
        var product = products.findByIdForStockAdjustment(productId)
                .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND));
        int beforeQuantity = product.getStockQuantity();
        product.adjustStock(request.delta());
        var adjustment = StockAdjustment.create(product, actor, request.delta(),
                beforeQuantity, product.getStockQuantity(), request.reason());
        return StockAdjustmentResponse.from(adjustments.save(adjustment));
    }
}
