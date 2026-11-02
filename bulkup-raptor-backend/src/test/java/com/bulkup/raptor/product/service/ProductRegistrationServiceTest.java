package com.bulkup.raptor.product.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.image.api.ImageUploadResponse;
import com.bulkup.raptor.image.application.service.RegisteredImageUploadService;
import com.bulkup.raptor.product.api.ProductRequest;
import com.bulkup.raptor.product.domain.ProductCategory;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.mock.web.MockMultipartFile;

class ProductRegistrationServiceTest {
    final RegisteredImageUploadService uploads = mock(RegisteredImageUploadService.class);
    final ProductService products = mock(ProductService.class);
    final ProductRegistrationService service = new ProductRegistrationService(uploads, products);
    final ProductRequest request = new ProductRequest("상품", "설명", 1000, ProductCategory.SUPPLEMENT, "", "🥛");
    final MockMultipartFile file = new MockMultipartFile("file", new byte[] {1});

    @Test
    void databaseFailureIsNotConvertedIntoOptionalImageWarning() {
        when(uploads.upload(file, 1L)).thenThrow(new DataAccessResourceFailureException("history unavailable"));
        assertThatThrownBy(() -> service.create(request, file, 1L)).isInstanceOf(DataAccessResourceFailureException.class);
        verifyNoInteractions(products);
    }

    @Test
    void authenticationFailureDoesNotCreateProduct() {
        assertThatThrownBy(() -> service.create(request, file, null))
                .isInstanceOf(BusinessException.class).extracting("errorCode").isEqualTo(ErrorCode.LOGIN_REQUIRED);
        verifyNoInteractions(uploads, products);
    }

    @Test
    void uploadAuthenticationErrorIsNotSwallowed() {
        when(uploads.upload(file, 1L)).thenThrow(new BusinessException(ErrorCode.LOGIN_REQUIRED));
        assertThatThrownBy(() -> service.create(request, file, 1L)).isInstanceOf(BusinessException.class);
        verifyNoInteractions(products);
    }

    @Test
    void productFailureAfterUploadDoesNotCreateAgainWithoutImage() {
        when(uploads.upload(file, 1L)).thenReturn(new ImageUploadResponse("images/test.png", "https://example.test/test.png", "image/png", 1, 1, 1));
        when(products.createWithImage(request, "images/test.png", 1L))
                .thenThrow(new DataAccessResourceFailureException("product unavailable"));
        assertThatThrownBy(() -> service.create(request, file, 1L)).isInstanceOf(DataAccessResourceFailureException.class);
        verify(products, never()).create(request);
    }
}
