package com.bulkup.raptor.admin.api;

import com.bulkup.raptor.permission.application.service.*;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/permissions")
@RequiredArgsConstructor
public class AdminPermissionController {
    private final PermissionCommandService commands;
    private final PermissionQueryService queries;

    @GetMapping
    public List<AdminPermissionResponse> list(
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String q) {
        return queries.list(categoryId, q);
    }

    @GetMapping("/{id}")
    public AdminPermissionResponse get(@PathVariable Long id) {
        return queries.get(id);
    }

    @PostMapping
    public ResponseEntity<AdminPermissionResponse> create(
            @AuthenticationPrincipal Long actor,
            @Valid @RequestBody AdminPermissionCreateRequest request) {
        var id =
                commands.create(
                        actor,
                        request.code(),
                        request.name(),
                        request.description(),
                        request.categoryId());
        return ResponseEntity.status(201).body(queries.get(id));
    }

    @PatchMapping("/{id}")
    public AdminPermissionResponse update(
            @AuthenticationPrincipal Long actor,
            @PathVariable Long id,
            @Valid @RequestBody AdminPermissionUpdateRequest request) {
        commands.update(actor, id, request.name(), request.description(), request.categoryId());
        return queries.get(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Long actor, @PathVariable Long id) {
        commands.delete(actor, id);
        return ResponseEntity.noContent().build();
    }
}
