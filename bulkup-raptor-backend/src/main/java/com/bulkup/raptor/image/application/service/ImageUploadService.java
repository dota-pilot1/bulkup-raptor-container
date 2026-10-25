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
import javax.imageio.stream.MemoryCacheImageInputStream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class ImageUploadService {
    public static final long MAX_FILE_SIZE = 5L * 1024 * 1024;
    private static final int MAX_DIMENSION = 4096;
    private static final Map<String, String> FORMATS = Map.of(
            "JPEG", "image/jpeg", "PNG", "image/png", "WEBP", "image/webp");
    private final ImageStorage storage;

    public ImageUploadResponse upload(MultipartFile file) {
        if (file.isEmpty()) throw new BusinessException(ErrorCode.IMAGE_FILE_REQUIRED);
        if (file.getSize() > MAX_FILE_SIZE) throw new BusinessException(ErrorCode.IMAGE_FILE_TOO_LARGE);
        if (file.getContentType() == null || !FORMATS.containsValue(file.getContentType())) {
            throw new BusinessException(ErrorCode.IMAGE_TYPE_NOT_SUPPORTED);
        }

        byte[] bytes;
        String contentType;
        String extension;
        int width;
        int height;
        try {
            // Bound the bytes even for MultipartFile implementations that report an incorrect size.
            try (var input = file.getInputStream()) {
                bytes = input.readNBytes((int) MAX_FILE_SIZE + 1);
            }
            if (bytes.length > MAX_FILE_SIZE) throw new BusinessException(ErrorCode.IMAGE_FILE_TOO_LARGE);
            try (var input = new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))) {
                var readers = ImageIO.getImageReaders(input);
                if (!readers.hasNext()) throw new BusinessException(ErrorCode.IMAGE_FILE_INVALID);
                ImageReader reader = readers.next();
                try {
                    reader.setInput(input, true, true);
                    String format = reader.getFormatName().toUpperCase(Locale.ROOT);
                    contentType = FORMATS.get(format);
                    if (contentType == null || !contentType.equals(file.getContentType())) {
                        throw new BusinessException(ErrorCode.IMAGE_FILE_INVALID);
                    }
                    width = reader.getWidth(0);
                    height = reader.getHeight(0);
                    if (width < 1 || height < 1) throw new BusinessException(ErrorCode.IMAGE_FILE_INVALID);
                    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                        throw new BusinessException(ErrorCode.IMAGE_DIMENSIONS_TOO_LARGE);
                    }
                    // Decode the image to reject files that only imitate a valid header.
                    if (reader.read(0) == null) throw new BusinessException(ErrorCode.IMAGE_FILE_INVALID);
                    extension = format.equals("JPEG") ? "jpg" : format.toLowerCase(Locale.ROOT);
                } finally {
                    reader.dispose();
                }
            }
        } catch (IOException | IllegalArgumentException | IndexOutOfBoundsException exception) {
            throw new BusinessException(ErrorCode.IMAGE_FILE_INVALID);
        }
        String key = "products/" + UUID.randomUUID() + "." + extension;
        String url = storage.upload(key, bytes, contentType);
        return new ImageUploadResponse(key, url, contentType, bytes.length, width, height);
    }
}
