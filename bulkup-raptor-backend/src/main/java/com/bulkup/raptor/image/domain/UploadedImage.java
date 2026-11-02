package com.bulkup.raptor.image.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "uploaded_images")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UploadedImage {
    @Id
    @Column(name = "storage_key", length = 255)
    private String key;

    @Column(name = "uploader_member_id", nullable = false)
    private Long uploaderMemberId;

    @Column(nullable = false, length = 2048)
    private String url;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public enum Status { STORED }

    // R2 저장이 성공한 뒤에만 이력을 만든다.
    public static UploadedImage stored(String key, Long memberId, String url) {
        var image = new UploadedImage();
        image.key = key;
        image.uploaderMemberId = memberId;
        image.url = url;
        image.status = Status.STORED;
        image.createdAt = Instant.now();
        return image;
    }
}
