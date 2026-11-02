package com.bulkup.raptor.product.service;

import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.image.application.service.RegisteredImageUploadService;
import com.bulkup.raptor.product.api.ProductRequest;
import com.bulkup.raptor.product.api.ProductResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class ProductUpdateService {
    private final RegisteredImageUploadService uploads;
    private final ProductService products;

    // R2 업로드 중에는 상품 수정 트랜잭션을 열지 않는다.
    public ProductResponse update(Long id, ProductRequest request, MultipartFile file, Long memberId) {
        if (memberId == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
        products.validateExists(id);

        if (file == null || file.isEmpty()) {
            return products.update(id, request);
        }

        String key = uploads.upload(file, memberId).key();
        // 업로드 실패는 그대로 전달하며 상품 정보를 일부만 저장하지 않는다.
        return products.updateWithImage(id, request, key, memberId);
    }
}
