package com.bulkup.raptor.product.service;

import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.image.application.service.RegisteredImageUploadService;
import com.bulkup.raptor.product.api.ProductCreateResponse;
import com.bulkup.raptor.product.api.ProductRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class ProductRegistrationService {
    private final RegisteredImageUploadService uploads;
    private final ProductService products;

    // 업로드와 상품 저장은 각 서비스의 트랜잭션에서 처리한다.
    public ProductCreateResponse create(ProductRequest request, MultipartFile file, Long memberId) {
        if (memberId == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
        if (file == null || file.isEmpty()) {
            return new ProductCreateResponse(products.create(request), null);
        }

        String key;
        try {
            key = uploads.upload(file, memberId).key();
        } catch (BusinessException exception) {
            // 파일 검사·저장소 실패만 허용하고 인증·DB 오류는 그대로 전달한다.
            if (!isOptionalImageFailure(exception.getErrorCode())) throw exception;
            return new ProductCreateResponse(products.create(request), exception.getErrorCode().name());
        }

        return new ProductCreateResponse(products.createWithImage(request, key, memberId), null);
    }

    private boolean isOptionalImageFailure(ErrorCode code) {
        return switch (code) {
            case IMAGE_FILE_REQUIRED, IMAGE_FILE_TOO_LARGE, IMAGE_TYPE_NOT_SUPPORTED,
                    IMAGE_FILE_INVALID, IMAGE_DIMENSIONS_TOO_LARGE,
                    IMAGE_STORAGE_NOT_CONFIGURED, IMAGE_STORAGE_FAILED -> true;
            default -> false;
        };
    }
}
