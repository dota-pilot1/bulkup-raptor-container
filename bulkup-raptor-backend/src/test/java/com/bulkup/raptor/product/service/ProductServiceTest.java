package com.bulkup.raptor.product.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
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

    @Test
    void 상품을_등록하고_배지_공백은_비운다() {
        ProductService service = new ProductService(productRepository);
        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ProductResponse response = service.create(new ProductRequest("  프로틴  ", "  기본 단백질  ", 28900, ProductCategory.SUPPLEMENT, "  ", "🥛"));

        assertThat(response.name()).isEqualTo("프로틴");
        assertThat(response.description()).isEqualTo("기본 단백질");
        assertThat(response.badge()).isNull();
        assertThat(response.categoryLabel()).isEqualTo("보충제");
    }

    @Test
    void 없는_상품은_수정할_수_없다() {
        ProductService service = new ProductService(productRepository);
        when(productRepository.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(9L, new ProductRequest("프로틴", "기본 단백질", 28900, ProductCategory.SUPPLEMENT, "BEST", "🥛")))
            .isInstanceOf(BusinessException.class)
            .extracting("errorCode")
            .isEqualTo(ErrorCode.PRODUCT_NOT_FOUND);
        verify(productRepository, never()).save(any());
    }

    @Test
    void 없는_상품은_삭제할_수_없다() {
        ProductService service = new ProductService(productRepository);
        when(productRepository.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete(9L))
            .isInstanceOf(BusinessException.class)
            .extracting("errorCode")
            .isEqualTo(ErrorCode.PRODUCT_NOT_FOUND);
        verify(productRepository, never()).delete(any());
    }
}
