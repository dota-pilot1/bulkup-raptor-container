package com.bulkup.raptor.product.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.image.api.ImageUploadResponse;
import com.bulkup.raptor.image.application.service.RegisteredImageUploadService;
import com.bulkup.raptor.product.api.ProductRequest;
import com.bulkup.raptor.product.domain.ProductCategory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.mock.web.MockMultipartFile;

@ExtendWith(MockitoExtension.class)
class ProductUpdateServiceTest {
    @Mock RegisteredImageUploadService uploads;
    @Mock ProductService products;
    @InjectMocks ProductUpdateService service;
    final ProductRequest request = new ProductRequest("상품", "설명", 1000, ProductCategory.SUPPLEMENT, "", "🥛");
    final MockMultipartFile file = new MockMultipartFile("file", "test.png", "image/png", new byte[] { 1 });

    @Test
    void unauthenticatedCallDoesNotUploadOrUpdate() {
        assertThatThrownBy(() -> service.update(1L, request, file, null))
                .isInstanceOf(BusinessException.class).extracting("errorCode").isEqualTo(ErrorCode.LOGIN_REQUIRED);
        verifyNoInteractions(uploads, products);
    }

    @Test
    void missingProductDoesNotUpload() {
        doThrow(new BusinessException(ErrorCode.PRODUCT_NOT_FOUND)).when(products).validateExists(1L);
        assertThatThrownBy(() -> service.update(1L, request, file, 2L)).isInstanceOf(BusinessException.class);
        verifyNoInteractions(uploads);
        verify(products, never()).updateWithImage(anyLong(), any(), anyString(), anyLong());
    }

    @Test
    void missingProductWithoutFileDoesNotUpdate() {
        doThrow(new BusinessException(ErrorCode.PRODUCT_NOT_FOUND)).when(products).validateExists(1L);
        assertThatThrownBy(() -> service.update(1L, request, null, 2L))
                .isInstanceOf(BusinessException.class).extracting("errorCode").isEqualTo(ErrorCode.PRODUCT_NOT_FOUND);
        verifyNoInteractions(uploads);
        verify(products, never()).update(anyLong(), any());
    }

    @Test
    void absentOrEmptyFileValidatesProductThenUpdatesWithoutUpload() {
        var emptyFile = new MockMultipartFile("file", new byte[0]);
        service.update(1L, request, null, 2L);
        service.update(1L, request, emptyFile, 2L);
        var order = inOrder(products);
        order.verify(products).validateExists(1L);
        order.verify(products).update(1L, request);
        order.verify(products).validateExists(1L);
        order.verify(products).update(1L, request);
        verifyNoInteractions(uploads);
    }

    @Test
    void uploadFailureDoesNotCallEitherProductUpdate() {
        when(uploads.upload(file, 2L)).thenThrow(new BusinessException(ErrorCode.IMAGE_STORAGE_FAILED));
        assertThatThrownBy(() -> service.update(1L, request, file, 2L))
                .isInstanceOf(BusinessException.class).extracting("errorCode").isEqualTo(ErrorCode.IMAGE_STORAGE_FAILED);
        verify(products, never()).update(anyLong(), any());
        verify(products, never()).updateWithImage(anyLong(), any(), anyString(), anyLong());
    }

    @Test
    void productSaveFailureIsPropagatedWithoutPartialFallbackOrDeletion() {
        when(uploads.upload(file, 2L)).thenReturn(new ImageUploadResponse("images/new.png", "https://images.test/new.png", "image/png", 1, 1, 1));
        when(products.updateWithImage(1L, request, "images/new.png", 2L))
                .thenThrow(new DataIntegrityViolationException("save failed"));
        assertThatThrownBy(() -> service.update(1L, request, file, 2L)).isInstanceOf(DataIntegrityViolationException.class);
        var order = inOrder(products, uploads);
        order.verify(products).validateExists(1L);
        order.verify(uploads).upload(file, 2L);
        order.verify(products).updateWithImage(1L, request, "images/new.png", 2L);
        verify(products, never()).update(anyLong(), any());
    }
}
