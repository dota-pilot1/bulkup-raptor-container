package com.bulkup.raptor.image.config;

import java.net.URI;
import java.time.Duration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;

// Spring이 객체 생성 설정을 읽는 클래스이다.
@Configuration
// app.r2 설정값을 담는 R2Properties 객체를 Spring에 등록한다.
@EnableConfigurationProperties(R2Properties.class)
public class R2Config {

    // R2ImageStorage의 clientProvider.getObject()가 이 빈을 요청한다.
    // R2에 저장 요청을 보낼 S3Client 객체를 생성한다.
    // @Bean: 반환 객체를 r2S3Client라는 이름의 빈으로 Spring이 관리한다.
    // destroyMethod: Spring이 종료될 때 close()를 호출하여 통신 자원을 정리한다.
    @Bean(destroyMethod = "close")
    // 처음 빈을 요청할 때 객체를 생성한다. 이후에는 같은 객체를 재사용한다.
    @Lazy
    // S3Client는 반환 타입이고, r2S3Client는 메서드 이름이다.
    // Spring이 접속 주소와 인증 정보가 담긴 R2Properties를 매개변수로 전달한다.
    public S3Client r2S3Client(R2Properties properties) {
        // builder()는 S3Client를 만들 때 사용할 설정을 모으는 빌더를 반환한다.
        return S3Client.builder()
                // AWS S3 기본 주소 대신 R2 접속 주소로 요청을 보낸다.
                .endpointOverride(URI.create(properties.getEndpoint()))
                // R2에 사용할 리전 값으로 auto를 지정한다.
                .region(Region.of("auto"))
                // R2 접근 키와 비밀 키를 인증에 사용한다.
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(
                        properties.getAccessKeyId(), properties.getSecretAccessKey())))
                // 버킷 이름을 요청 경로에 넣고, 청크 전송을 사용하지 않는다.
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(true).chunkedEncodingEnabled(false).build())
                // API가 요구하는 경우에만 요청 체크섬을 계산한다.
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                // API가 요구하는 경우에만 응답 체크섬을 검증한다.
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                // 연결 제한 시간은 5초이고, 소켓 읽기 제한 시간은 15초이다.
                .httpClientBuilder(UrlConnectionHttpClient.builder()
                        .connectionTimeout(Duration.ofSeconds(5)).socketTimeout(Duration.ofSeconds(15)))
                // 전체 API 호출은 30초, 개별 시도는 20초로 제한한다.
                .overrideConfiguration(config -> config
                        .apiCallTimeout(Duration.ofSeconds(30))
                        .apiCallAttemptTimeout(Duration.ofSeconds(20)))
                // 모은 설정으로 실제 S3Client 객체를 생성하여 반환한다.
                .build();
    }
}
