package com.bulkup.raptor.image.api;

import org.springframework.security.core.annotation.AuthenticationPrincipal;

import com.bulkup.raptor.image.application.service.RegisteredImageUploadService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
// 기존 관리자 경로는 호환용으로 유지하며 상품 관리 권한 검사를 적용한다.
@RequestMapping({"/api/images", "/api/admin/images"})
@RequiredArgsConstructor
public class ImageUploadController {
    private final RegisteredImageUploadService service;

    @Operation(summary = "이미지 업로드",
            description = "로그인이 필요하다. JPG·PNG·WebP 1장, 최대 5MiB를 허용한다. 업로드 결과를 상품이나 프로필에 연결하는 작업은 별도 API에서 처리한다. 기존 /api/admin/images 경로는 PRODUCT_MANAGE 권한이 필요하다.")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImageUploadResponse> upload(
            @Parameter(description = "업로드할 이미지", required = true,
                    content = @Content(schema = @Schema(type = "string", format = "binary")))
            @RequestPart("file") MultipartFile file,
            @AuthenticationPrincipal Long memberId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.upload(file, memberId));
    }
}
