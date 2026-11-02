package com.bulkup.raptor.image.application.service;

import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.image.api.ImageUploadResponse;
import com.bulkup.raptor.image.application.port.ImageStorage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.MemoryCacheImageInputStream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class ImageUploadService {
    // 파일 용량은 최대 5MiB로 제한한다.
    public static final long MAX_FILE_SIZE = 5L * 1024 * 1024;
    // 적용 보류: 최대 해상도 검사를 다시 사용할 때 적용할 기준이다.
    private static final int MAX_DIMENSION = 4096;
    // 실제 이미지 형식 이름을 응답에 사용할 Content-Type으로 연결한다.
    private static final Map<String, String> FORMATS = Map.of(
            "JPEG", "image/jpeg", "PNG", "image/png", "WEBP", "image/webp");
    // 생성자로 받은 저장소 구현체에 파일 저장을 요청한다.
    private final ImageStorage storage;

    public ImageUploadResponse upload(MultipartFile file) {
        // 1. 파일 내용을 읽기 전에 빈 파일, 요청 크기와 파일 형식을 검사한다.
        validateRequest(file);

        // 2. 업로드할 파일 내용 전체를 바이트 배열에 담는다.
        byte[] bytes = readFileBytesWithSizeLimit(file);

        // 3. bytes의 실제 이미지 형식을 검사하고 가로와 세로 정보를 읽는다.
        ImageInfo image = readValidatedImageInfo(bytes, file.getContentType());

        // 4. 사용 목적에 종속되지 않는 images 경로와 UUID로 저장 경로를 만든다.
        String key = "images/" + UUID.randomUUID() + "." + image.extension();

        // 5. 원본 bytes의 R2 업로드를 요청하고, 완료 후 반환된 공개 URL을 받는다.
        String url = storage.upload(key, bytes, image.contentType());

        // 6. 저장 경로, 공개 URL과 검사한 이미지 정보를 응답으로 반환한다.
        return new ImageUploadResponse(
                key, url, image.contentType(), bytes.length, image.width(), image.height());
    }

    private void validateRequest(MultipartFile file) {
        validateFilePresent(file);
        validateReportedFileSize(file);
        validateRequestedContentType(file.getContentType());
    }

    private void validateFilePresent(MultipartFile file) {
        if (file.isEmpty()) throw new BusinessException(ErrorCode.IMAGE_FILE_REQUIRED);
    }

    private void validateReportedFileSize(MultipartFile file) {
        if (file.getSize() > MAX_FILE_SIZE) throw new BusinessException(ErrorCode.IMAGE_FILE_TOO_LARGE);
    }

    private void validateRequestedContentType(String contentType) {
        if (contentType == null || !FORMATS.containsValue(contentType)) {
            throw new BusinessException(ErrorCode.IMAGE_TYPE_NOT_SUPPORTED);
        }
    }

    private byte[] readFileBytesWithSizeLimit(MultipartFile file) {
        byte[] bytes;
        // 최대 크기보다 1바이트 더 읽어 실제 용량 초과를 확인한다.
        try (var input = file.getInputStream()) {
            bytes = input.readNBytes((int) MAX_FILE_SIZE + 1);
        } catch (IOException | IllegalArgumentException | IndexOutOfBoundsException exception) {
            throw new BusinessException(ErrorCode.IMAGE_FILE_INVALID);
        }
        if (bytes.length > MAX_FILE_SIZE) throw new BusinessException(ErrorCode.IMAGE_FILE_TOO_LARGE);
        return bytes;
    }

    private ImageInfo readValidatedImageInfo(byte[] bytes, String requestedContentType) {
        // 이미 읽은 bytes를 순서대로 읽을 수 있는 스트림으로 감싼다.
        ByteArrayInputStream byteInput = new ByteArrayInputStream(bytes);
        // 바이트 스트림을 이미지 리더가 사용할 입력으로 감싼다.
        MemoryCacheImageInputStream input = new MemoryCacheImageInputStream(byteInput);
        // 처리가 끝나면 이미지 입력 자원을 자동으로 정리한다.
        try (input) {
            // 이 입력의 이미지 형식을 읽을 수 있는 리더를 선택한다.
            ImageReader reader = findImageReader(input);
            try {
                // 리더에 입력을 연결한다. 첫 true는 앞으로만 읽기, 둘째 true는 부가 메타데이터 생략을 허용한다.
                reader.setInput(input, true, true);

                // 1. 실제 형식이 지원 대상인지 검사하고 요청 Content-Type과 비교한다.
                String format = readSupportedFormat(reader);

                // 리더가 찾은 형식 이름을 대문자로 변환해 Map에서 실제 Content-Type을 찾는다.
                // Map에 없는 형식 이름이면 거부한다.
                String contentType = FORMATS.get(format);

                // Content-Type이 null이 아니면 요청된 Content-Type과 같은지 검증한다.
                validateContentType(contentType, requestedContentType);

                // 2. 응답에 사용할 가로와 세로를 읽고 양수인지 검사한다.
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                validatePositiveDimensions(width, height);

                // 적용 보류: 가로 또는 세로가 4096픽셀을 넘는 이미지의 거부를 중단한다.
                // validateMaximumDimensions(width, height);

                // 적용 보류: 전체 이미지 해석을 통한 손상 검사를 중단한다.
                // validateImageDecoding(reader);

                // 3. 파일 내용과 별개로, 확인한 형식과 해상도 정보만 반환한다.
                String extension = format.equals("JPEG") ? "jpg" : format.toLowerCase(Locale.ROOT);
                return new ImageInfo(contentType, extension, width, height);
            } finally {
                reader.dispose();
            }
        } catch (IOException | IllegalArgumentException | IndexOutOfBoundsException exception) {
            throw new BusinessException(ErrorCode.IMAGE_FILE_INVALID);
        }
    }

    private ImageReader findImageReader(ImageInputStream input) {
        // 입력 내용을 읽을 수 있는 이미지 리더 후보를 찾는다.
        var readers = ImageIO.getImageReaders(input);
        // 후보가 없으면 이미지 형식을 인식할 수 없으므로 거부한다.
        if (!readers.hasNext()) throw new BusinessException(ErrorCode.IMAGE_FILE_INVALID);
        // 첫 번째 후보 리더를 꺼내 반환한다.
        return readers.next();
    }

    private String readSupportedFormat(ImageReader reader) throws IOException {
        String format = reader.getFormatName().toUpperCase(Locale.ROOT);
        if (!FORMATS.containsKey(format)) throw new BusinessException(ErrorCode.IMAGE_FILE_INVALID);
        return format;
    }

    private void validateContentType(String contentType, String requestedContentType) {
        if (!contentType.equals(requestedContentType)) {
            throw new BusinessException(ErrorCode.IMAGE_FILE_INVALID);
        }
    }

    private void validatePositiveDimensions(int width, int height) {
        if (width < 1 || height < 1) throw new BusinessException(ErrorCode.IMAGE_FILE_INVALID);
    }

    // 적용 보류: 호출부의 주석을 해제하면 최대 해상도 제한을 다시 적용한다.
    private void validateMaximumDimensions(int width, int height) {
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            throw new BusinessException(ErrorCode.IMAGE_DIMENSIONS_TOO_LARGE);
        }
    }

    // 적용 보류: 호출부의 주석을 해제하면 첫 이미지의 실제 해석으로 손상을 검사한다.
    private void validateImageDecoding(ImageReader reader) throws IOException {
        if (reader.read(0) == null) throw new BusinessException(ErrorCode.IMAGE_FILE_INVALID);
    }

    // 파일 내용인 bytes와 구분하여, 검사로 확인한 이미지 정보만 묶는다.
    private record ImageInfo(String contentType, String extension, int width, int height) {}
}
