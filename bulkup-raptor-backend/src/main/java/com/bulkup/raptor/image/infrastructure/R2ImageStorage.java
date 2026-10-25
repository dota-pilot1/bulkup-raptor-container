package com.bulkup.raptor.image.infrastructure;

import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.image.application.port.ImageStorage;
import com.bulkup.raptor.image.config.R2Properties;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

// Spring이 이 클래스의 객체를 생성하고 빈으로 관리한다.
@Component
// Lombok이 final 필드 두 개를 받는 생성자를 만들고, Spring이 생성자로 주입한다.
@RequiredArgsConstructor
public class R2ImageStorage implements ImageStorage {

    // ObjectProvider는 생성자에서 바로 주입받는다.
    // getObject()는 Spring이 관리하는 S3Client 객체를 반환한다.
    // 아직 생성되지 않았다면 먼저 생성한 뒤 반환한다.
    private final ObjectProvider<S3Client> clientProvider;

    // app.r2 설정값이 필드에 들어 있는 객체를 생성자로 전달받는다.
    private final R2Properties properties;

    @Override
    // key: 버킷 내부 파일 경로, content: 파일 바이트, contentType: image/png 등의 형식이다.
    public String upload(String key, byte[] content, String contentType) {
        // 필수 설정값이 비어 있으면 업로드를 중단한다.
        if (!properties.isConfigured()) {
            throw new BusinessException(ErrorCode.IMAGE_STORAGE_NOT_CONFIGURED);
        }
        try {
            // 1. Spring에서 R2 통신에 사용할 S3Client 객체를 가져온다.
            S3Client client = clientProvider.getObject();

            // 2. 저장할 버킷·파일 경로·파일 형식을 요청 객체 하나로 묶는다.
            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(properties.getBucket())
                    .key(key)
                    .contentType(contentType)
                    // 같은 주소의 파일을 최대 1년간 캐시할 수 있으며 내용이 바뀌지 않음을 알린다.
                    .cacheControl("public, max-age=31536000, immutable")
                    .build();

            // 3. 실제로 보낼 파일 바이트를 요청 본문 객체에 담는다.
            RequestBody body = RequestBody.fromBytes(content);

            // 4. 저장 정보(request)와 파일 내용(body)을 두 인수로 전달하여 업로드한다.
            client.putObject(request, body);
        } catch (SdkException exception) {
            // SDK 오류 원문 대신 우리 서비스의 업로드 실패 오류를 반환한다.
            throw new BusinessException(ErrorCode.IMAGE_STORAGE_FAILED);
        }
        // 공개 기본 주소 끝의 /를 제거하고 파일 경로를 붙여 이미지 조회 URL을 반환한다.
        return properties.getPublicBaseUrl().replaceAll("/+$", "") + "/" + key;
    }
}
