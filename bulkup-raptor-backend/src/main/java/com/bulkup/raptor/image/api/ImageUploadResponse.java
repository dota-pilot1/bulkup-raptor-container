package com.bulkup.raptor.image.api;

import io.swagger.v3.oas.annotations.media.Schema;

public record ImageUploadResponse(
        @Schema(description = "R2 객체 경로. 이후 상품 이미지 연결에 사용한다.") String key,
        @Schema(description = "이미지 조회용 공개 URL") String url,
        String contentType,
        long size,
        int width,
        int height) {}
