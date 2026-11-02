package com.bulkup.raptor.image.repository;

import com.bulkup.raptor.image.domain.UploadedImage;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UploadedImageRepository extends JpaRepository<UploadedImage, String> {
    // 파일 키, 업로드한 회원, 저장 상태가 모두 일치하는 이미지 이력을 찾는다.
    @Query("""
            select image from UploadedImage image
            where image.key = :key
              and image.uploaderMemberId = :memberId
              and image.status = :status
            """)
    Optional<UploadedImage> findOwnedImage(
            @Param("key") String key,
            @Param("memberId") Long memberId,
            @Param("status") UploadedImage.Status status);
}
