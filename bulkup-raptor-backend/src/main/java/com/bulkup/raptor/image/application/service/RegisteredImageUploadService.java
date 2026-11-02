package com.bulkup.raptor.image.application.service;

import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.image.api.ImageUploadResponse;
import com.bulkup.raptor.image.domain.UploadedImage;
import com.bulkup.raptor.image.repository.UploadedImageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class RegisteredImageUploadService {
    private final ImageUploadService uploads;
    private final UploadedImageRepository images;

    @Transactional
    public ImageUploadResponse upload(MultipartFile file, Long memberId) {
        if (memberId == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
        var result = uploads.upload(file);
        // 이력 저장 실패 시 성공 응답을 보내지 않는다. R2 파일 정리는 별도 작업이다.
        images.saveAndFlush(UploadedImage.stored(result.key(), memberId, result.url()));
        return result;
    }
}
