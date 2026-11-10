package com.bulkup.raptor.inventory.application.service;

import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.inventory.api.StockAdjustmentPageResponse;
import com.bulkup.raptor.inventory.api.StockAdjustmentResponse;
import com.bulkup.raptor.inventory.infrastructure.mybatis.StockAdjustmentQueryMapper;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class StockAdjustmentQueryService {
    private final StockAdjustmentQueryMapper adjustments;

    @Transactional(readOnly = true)
    public StockAdjustmentPageResponse list(Long productId, int page, int size) {
        if (productId == null || productId < 1 || page < 0 || size < 1 || size > 100
                || (long) page * size > Integer.MAX_VALUE) {
            throw new BusinessException(ErrorCode.INVALID_INPUT);
        }
        if (!adjustments.existsProduct(productId)) {
            throw new BusinessException(ErrorCode.PRODUCT_NOT_FOUND);
        }
        long total = adjustments.countByProductId(productId);
        long pageCount = total / size + (total % size == 0 ? 0 : 1);
        int totalPages = (int) Math.min(pageCount, Integer.MAX_VALUE);
        long offset = (long) page * size;
        List<StockAdjustmentResponse> content = total == 0 ? List.of()
                : adjustments.findByProductId(productId, size, offset).stream()
                        .map(StockAdjustmentResponse::from).toList();
        return new StockAdjustmentPageResponse(content, page, size, total, totalPages);
    }
}
