package com.bulkup.raptor.image;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.image.application.port.ImageStorage;
import com.bulkup.raptor.image.application.service.ImageUploadService;
import java.io.IOException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

class ImageUploadServiceTest {
    private final ImageStorage storage = mock(ImageStorage.class);
    private final ImageUploadService service = new ImageUploadService(storage);

    @Test
    void rejectsOversizedBytesEvenWhenReportedSizeIsSmall() {
        var file = new MockMultipartFile(
                "file", "image.png", "image/png", new byte[(int) ImageUploadService.MAX_FILE_SIZE + 1]) {
            @Override
            public long getSize() {
                return 1;
            }
        };

        assertThatThrownBy(() -> service.upload(file))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.IMAGE_FILE_TOO_LARGE);
        verifyNoInteractions(storage);
    }

    @Test
    void convertsFileReadFailureBeforeCallingStorage() throws IOException {
        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(file.getSize()).thenReturn(1L);
        when(file.getContentType()).thenReturn("image/png");
        when(file.getInputStream()).thenThrow(new IOException("read failed"));

        assertThatThrownBy(() -> service.upload(file))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.IMAGE_FILE_INVALID);
        verifyNoInteractions(storage);
    }
}
