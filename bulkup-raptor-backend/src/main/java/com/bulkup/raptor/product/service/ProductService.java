package com.bulkup.raptor.product.service;

import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.image.domain.UploadedImage;
import com.bulkup.raptor.image.repository.UploadedImageRepository;
import com.bulkup.raptor.product.api.ProductRequest;
import com.bulkup.raptor.product.api.ProductResponse;
import com.bulkup.raptor.product.domain.Product;
import com.bulkup.raptor.product.domain.ProductCategory;
import com.bulkup.raptor.product.repository.ProductRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final UploadedImageRepository images;

    @Transactional(readOnly = true)
    public List<ProductResponse> list() {
        return productRepository.findAllByOrderByIdAsc().stream().map(ProductResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public ProductResponse get(Long id) {
        return ProductResponse.from(findProduct(id));
    }

    @Transactional(readOnly = true)
    public void validateExists(Long id) {
        if (!productRepository.existsById(id)) {
            throw new BusinessException(ErrorCode.PRODUCT_NOT_FOUND);
        }
    }

    @Transactional
    public ProductResponse create(ProductRequest request) {
        return saveProduct(request, null);
    }

    @Transactional
    public ProductResponse createWithImage(ProductRequest request, String key, Long memberId) {
        var image = images.findOwnedImage(key, memberId, UploadedImage.Status.STORED)
                .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_IMAGE_NOT_AVAILABLE));
        return saveProduct(request, image);
    }

    private ProductResponse saveProduct(ProductRequest request, UploadedImage image) {
        // 이전 클라이언트의 생략·null 요청은 초기 재고 0으로 등록한다.
        int stockQuantity = request.stockQuantity() == null ? 0 : request.stockQuantity();
        if (stockQuantity < 0) {
            throw new BusinessException(ErrorCode.INVALID_INPUT);
        }
        Product product = Product.create(
            request.name().trim(),
            request.description().trim(),
            request.price(),
            request.category(),
            normalizeBadge(request.badge()),
            request.visual().trim(),
            stockQuantity
        );
        product.attachImage(image);
        return ProductResponse.from(productRepository.save(product));
    }

    @Transactional
    public ProductResponse update(Long id, ProductRequest request) {
        Product product = productRepository.findByIdForStockAdjustment(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND));
        changeProduct(product, request);
        return ProductResponse.from(product);
    }

    @Transactional
    public ProductResponse updateWithImage(Long id, ProductRequest request, String key, Long memberId) {
        Product product = productRepository.findByIdForStockAdjustment(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND));
        var image = images.findOwnedImage(key, memberId, UploadedImage.Status.STORED)
                .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_IMAGE_NOT_AVAILABLE));
        changeProduct(product, request);
        product.attachImage(image);
        productRepository.flush();
        return ProductResponse.from(product);
    }

    private void changeProduct(Product product, ProductRequest request) {
        // 일반 상품 수정은 초기 재고 입력값을 사용하지 않는다. 증감은 별도 기능으로 구현한다.
        product.change(
            request.name().trim(),
            request.description().trim(),
            request.price(),
            request.category(),
            normalizeBadge(request.badge()),
            request.visual().trim()
        );
    }

    @Transactional
    public void delete(Long id) {
        Product product = productRepository.findByIdForStockAdjustment(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND));
        productRepository.delete(product);
    }

    @Transactional
    public void seedIfEmpty() {
        if (productRepository.count() > 0) {
            return;
        }
        productRepository.save(Product.create("데일리 프로틴 쉐이크", "매일 부담 없이 시작하는 기본 단백질", 28900, ProductCategory.SUPPLEMENT, "BEST", "🥛"));
        productRepository.save(Product.create("클린 에너지 바", "운동 전후 간편하게 채우는 에너지", 15900, ProductCategory.SNACK, "NEW", "🍫"));
        productRepository.save(Product.create("리커버리 아미노", "운동 후 회복을 위한 데일리 루틴", 23900, ProductCategory.SUPPLEMENT, null, "🍋"));
        productRepository.save(Product.create("스타터 웰니스 세트", "처음 시작하는 분을 위한 알찬 구성", 44900, ProductCategory.STARTER_SET, "SET", "📦"));
    }

    private Product findProduct(Long id) {
        return productRepository.findById(id).orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND));
    }

    static String normalizeBadge(String badge) {
        if (badge == null || badge.isBlank()) {
            return null;
        }
        return badge.trim();
    }
}
