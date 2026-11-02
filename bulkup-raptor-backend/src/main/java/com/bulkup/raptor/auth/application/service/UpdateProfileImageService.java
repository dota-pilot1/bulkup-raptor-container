package com.bulkup.raptor.auth.application.service;

import com.bulkup.raptor.auth.api.ProfileImageResponse;
import com.bulkup.raptor.auth.domain.MemberStatus;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.image.domain.UploadedImage;
import com.bulkup.raptor.image.repository.UploadedImageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UpdateProfileImageService {
    private final MemberRepository members;
    private final UploadedImageRepository images;

    @Transactional
    public ProfileImageResponse update(Long memberId, String key) {
        if (memberId == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);

        // ID로 회원을 조회하고, 같은 회원의 다른 수정 요청이 대기하도록 행을 잠근다.
        var member = members.findByIdForUpdate(memberId)
                .orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_REQUIRED));

        // 회원이 유효한 상태인지 확인한다.
        if (member.getStatus() != MemberStatus.ACTIVE) {
            throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
        }

        // 요청한 키가 본인이 업로드한 저장 완료 이미지인지 확인한다.
        var image = images.findOwnedImage(
                        key, memberId, UploadedImage.Status.STORED)
                // 조건에 맞는 이미지가 없으면 프로필 연결을 거부한다.
                .orElseThrow(() -> new BusinessException(ErrorCode.PROFILE_IMAGE_NOT_AVAILABLE));

        // 회원의 프로필 이미지를 교체한다.
        member.changeProfileImage(image);

        // 영속성 컨텍스트에 반영한다.
        members.flush();
        return new ProfileImageResponse(image.getUrl());
    }
}
