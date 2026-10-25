package com.bulkup.raptor.image;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.image.config.R2Properties;
import com.bulkup.raptor.image.infrastructure.R2ImageStorage;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

class R2ImageStorageTest {
    @SuppressWarnings("unchecked")
    private final ObjectProvider<S3Client> provider = mock(ObjectProvider.class);
    private final S3Client client = mock(S3Client.class);
    private final R2Properties properties = new R2Properties();
    private final R2ImageStorage storage = new R2ImageStorage(provider, properties);

    @Test
    void missingConfigurationDoesNotCreateClient() {
        assertThatThrownBy(() -> storage.upload("products/test.png", new byte[]{1}, "image/png"))
                .isInstanceOf(BusinessException.class).extracting("errorCode")
                .isEqualTo(ErrorCode.IMAGE_STORAGE_NOT_CONFIGURED);
        verifyNoInteractions(provider);
    }

    @Test
    void writesCorrectMetadataAndBuildsPublicUrl() {
        configure();
        byte[] content = {1, 2, 3};
        assertThat(storage.upload("products/test.png", content, "image/png"))
                .isEqualTo("https://images.example.com/products/test.png");
        var request = org.mockito.ArgumentCaptor.forClass(PutObjectRequest.class);
        var body = org.mockito.ArgumentCaptor.forClass(RequestBody.class);
        verify(client).putObject(request.capture(), body.capture());
        assertThat(request.getValue().bucket()).isEqualTo("test-bucket");
        assertThat(request.getValue().contentType()).isEqualTo("image/png");
        assertThat(request.getValue().key()).isEqualTo("products/test.png");
        assertThat(body.getValue().optionalContentLength()).hasValue(3L);
    }

    @Test
    void sdkErrorsDoNotLeakCredentialsOrProviderDetails() {
        configure();
        when(client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
                .thenThrow(SdkClientException.create("private provider details"));
        assertThatThrownBy(() -> storage.upload("products/test.png", new byte[]{1}, "image/png"))
                .isInstanceOf(BusinessException.class).extracting("errorCode")
                .isEqualTo(ErrorCode.IMAGE_STORAGE_FAILED);
    }

    private void configure() {
        properties.setAccessKeyId("test");
        properties.setSecretAccessKey("test");
        properties.setEndpoint("https://example.com");
        properties.setBucket("test-bucket");
        properties.setPublicBaseUrl("https://images.example.com/");
        when(provider.getObject()).thenReturn(client);
    }
}
