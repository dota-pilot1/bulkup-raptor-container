package com.bulkup.raptor.image.api;

import com.bulkup.raptor.image.application.service.ImageUploadService;
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
@RequestMapping("/api/admin/images")
@RequiredArgsConstructor
public class ImageUploadController {
    private final ImageUploadService service;

    @Operation(summary = "상품 이미지 업로드",
            description = "PRODUCT_MANAGE 권한이 필요하다. JPG·PNG·WebP 1장, 최대 5MB, 가로·세로 최대 4096픽셀을 허용한다. 상품 저장은 별도 API에서 처리한다.")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImageUploadResponse> upload(
            @Parameter(description = "상품 대표 이미지", required = true,
                    content = @Content(schema = @Schema(type = "string", format = "binary")))
            @RequestPart("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.upload(file));
    }
}
