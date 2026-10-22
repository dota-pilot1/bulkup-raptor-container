package com.bulkup.raptor.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Tag(name = "Health Check", description = "서버 상태 점검 API")
@RestController
@RequestMapping("/api/health")
public class HealthController {

    @Operation(summary = "헬스 체크", description = "서버 정상 구동 여부를 확인합니다.")
    @GetMapping
    public ResponseEntity<Map<String, Object>> checkHealth() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "service", "bulkup-raptor-backend"
        ));
    }
}
