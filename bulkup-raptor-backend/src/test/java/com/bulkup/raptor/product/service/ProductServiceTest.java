package com.bulkup.raptor.product.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.image.repository.UploadedImageRepository;
import com.bulkup.raptor.image.domain.UploadedImage;
import com.bulkup.raptor.product.api.ProductRequest;
import com.bulkup.raptor.product.api.ProductResponse;
import com.bulkup.raptor.product.domain.Product;
import com.bulkup.raptor.product.domain.ProductCategory;
import com.bulkup.raptor.product.repository.ProductRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private UploadedImageRepository images;

    @Test
    void 상품을_등록하고_배지_공백은_비운다() {
        ProductService service = new ProductService(productRepository, images);
        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ProductResponse response = service.create(new ProductRequest("  프로틴  ", "  기본 단백질  ", 28900, ProductCategory.SUPPLEMENT, "  ", "🥛"));

        assertThat(response.name()).isEqualTo("프로틴");
        assertThat(response.description()).isEqualTo("기본 단백질");
        assertThat(response.badge()).isNull();
        assertThat(response.categoryLabel()).isEqualTo("보충제");
    }

    @Test
    void 없는_상품은_수정할_수_없다() {
        ProductService service = new ProductService(productRepository, images);
        when(productRepository.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(9L, new ProductRequest("프로틴", "기본 단백질", 28900, ProductCategory.SUPPLEMENT, "BEST", "🥛")))
            .isInstanceOf(BusinessException.class)
            .extracting("errorCode")
            .isEqualTo(ErrorCode.PRODUCT_NOT_FOUND);
        verify(productRepository, never()).save(any());
    }

    @Test
    void 없는_상품은_삭제할_수_없다() {
        ProductService service = new ProductService(productRepository, images);
        when(productRepository.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete(9L))
            .isInstanceOf(BusinessException.class)
            .extracting("errorCode")
            .isEqualTo(ErrorCode.PRODUCT_NOT_FOUND);
        verify(productRepository, never()).delete(any());
    }

    @Test
    void 본인_이미지로_상품을_생성한다() {
        var service = new ProductService(productRepository, images);
        var image = UploadedImage.stored("images/test.png", 1L, "https://images.example.test/test.png");
        when(images.findOwnedImage(image.getKey(), 1L, UploadedImage.Status.STORED)).thenReturn(Optional.of(image));
        when(productRepository.save(any(Product.class))).thenAnswer(call -> call.getArgument(0));

        var response = service.createWithImage(new ProductRequest("상품", "설명", 1000, ProductCategory.SUPPLEMENT, "", "🥛"), image.getKey(), 1L);

        assertThat(response.imageUrl()).isEqualTo(image.getUrl());
    }

    @Test
    void 사용_불가능한_이미지는_상품에_연결하지_않는다() {
        var service = new ProductService(productRepository, images);
        when(images.findOwnedImage("images/foreign.png", 1L, UploadedImage.Status.STORED)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createWithImage(new ProductRequest("상품", "설명", 1000, ProductCategory.SUPPLEMENT, "", "🥛"), "images/foreign.png", 1L))
                .isInstanceOf(BusinessException.class).extracting("errorCode").isEqualTo(ErrorCode.PRODUCT_IMAGE_NOT_AVAILABLE);
        verify(productRepository, never()).save(any());
    }

    @Test
    void 본인_이미지로_상품_정보와_이미지를_함께_수정한다() {
        var service = new ProductService(productRepository, images);
        var product = Product.create("기존", "설명", 1000, ProductCategory.SUPPLEMENT, null, "🥛");
        var image = UploadedImage.stored("images/new.png", 1L, "https://images.example.test/new.png");
        when(productRepository.findById(9L)).thenReturn(Optional.of(product));
        when(images.findOwnedImage(image.getKey(), 1L, UploadedImage.Status.STORED)).thenReturn(Optional.of(image));

        var response = service.updateWithImage(9L,
                new ProductRequest("  수정  ", "  설명  ", 2000, ProductCategory.SNACK, "  ", "🥛"), image.getKey(), 1L);

        assertThat(response.name()).isEqualTo("수정");
        assertThat(response.price()).isEqualTo(2000);
        assertThat(response.badge()).isNull();
        assertThat(response.imageUrl()).isEqualTo(image.getUrl());
        verify(productRepository).flush();
    }

    @Test
    void 타인_이미지나_없는_이미지이면_상품_정보도_변경하지_않는다() {
        var service = new ProductService(productRepository, images);
        var product = Product.create("기존", "설명", 1000, ProductCategory.SUPPLEMENT, null, "🥛");
        var oldImage = UploadedImage.stored("images/old.png", 2L, "https://images.example.test/old.png");
        product.attachImage(oldImage);
        when(productRepository.findById(9L)).thenReturn(Optional.of(product));
        when(images.findOwnedImage("images/foreign.png", 1L, UploadedImage.Status.STORED)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateWithImage(9L,
                new ProductRequest("수정", "설명", 2000, ProductCategory.SNACK, "", "🥛"), "images/foreign.png", 1L))
                .isInstanceOf(BusinessException.class).extracting("errorCode").isEqualTo(ErrorCode.PRODUCT_IMAGE_NOT_AVAILABLE);
        assertThat(product.getName()).isEqualTo("기존");
        assertThat(product.getImage()).isSameAs(oldImage);
        verify(productRepository, never()).flush();
    }
}
