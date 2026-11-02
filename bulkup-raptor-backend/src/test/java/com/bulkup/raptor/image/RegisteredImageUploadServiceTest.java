package com.bulkup.raptor.image;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.image.api.ImageUploadResponse;
import com.bulkup.raptor.image.application.service.ImageUploadService;
import com.bulkup.raptor.image.application.service.RegisteredImageUploadService;
import com.bulkup.raptor.image.repository.UploadedImageRepository;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.mock.web.MockMultipartFile;

class RegisteredImageUploadServiceTest {
    final ImageUploadService uploads = mock(ImageUploadService.class);
    final UploadedImageRepository images = mock(UploadedImageRepository.class);
    final RegisteredImageUploadService service = new RegisteredImageUploadService(uploads, images);
    final MockMultipartFile file = new MockMultipartFile("file", new byte[] {1});

    @Test
    void historyFailureDoesNotReturnSuccessfulUpload() {
        when(uploads.upload(file)).thenReturn(new ImageUploadResponse(
                "images/key.png", "https://example.test/images/key.png", "image/png", 1L, 1, 1));
        when(images.saveAndFlush(any())).thenThrow(new DataAccessResourceFailureException("database unavailable"));
        assertThatThrownBy(() -> service.upload(file, 1L))
                .isInstanceOf(DataAccessResourceFailureException.class);
        verify(uploads).upload(file);
    }

    @Test
    void missingMemberDoesNotUploadOrRecordAnything() {
        assertThatThrownBy(() -> service.upload(file, null)).isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.LOGIN_REQUIRED);
        verifyNoInteractions(uploads, images);
    }
}
