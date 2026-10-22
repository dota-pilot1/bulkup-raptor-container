package com.bulkup.raptor.admin.api;

import com.bulkup.raptor.permission.application.service.*;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/permission-categories")
@RequiredArgsConstructor
public class AdminPermissionCategoryController {
    private final PermissionCategoryCommandService commands;
    private final PermissionCategoryQueryService queries;

    @GetMapping
    public List<AdminPermissionCategoryResponse> list() {
        return queries.list();
    }

    @GetMapping("/{id}")
    public AdminPermissionCategoryResponse get(@PathVariable Long id) {
        return queries.get(id);
    }

    @PostMapping
    public ResponseEntity<AdminPermissionCategoryResponse> create(
            @AuthenticationPrincipal Long actor,
            @Valid @RequestBody AdminPermissionCategoryCreateRequest r) {
        return ResponseEntity.status(201)
                .body(
                        queries.get(
                                commands.create(
                                        actor,
                                        r.code(),
                                        r.name(),
                                        r.description(),
                                        r.sortOrder())));
    }

    @PatchMapping("/{id}")
    public AdminPermissionCategoryResponse update(
            @AuthenticationPrincipal Long actor,
            @PathVariable Long id,
            @Valid @RequestBody AdminPermissionCategoryUpdateRequest r) {
        commands.update(actor, id, r.name(), r.description(), r.sortOrder());
        return queries.get(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Long actor, @PathVariable Long id) {
        commands.delete(actor, id);
        return ResponseEntity.noContent().build();
    }
}
