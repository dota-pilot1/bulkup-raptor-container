package com.bulkup.raptor.admin.api;

import com.bulkup.raptor.role.application.service.*;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/roles")
@RequiredArgsConstructor
public class AdminRoleController {
    private final RoleCommandService commands;
    private final RoleQueryService queries;

    @GetMapping
    public List<AdminRoleResponse> list() {
        return queries.list();
    }

    @GetMapping("/{id}")
    public AdminRoleResponse get(@PathVariable Long id) {
        return queries.get(id);
    }

    @PostMapping
    public ResponseEntity<AdminRoleResponse> create(
            @AuthenticationPrincipal Long actor,
            @Valid @RequestBody AdminRoleCreateRequest request) {
        var id =
                commands.create(
                        actor,
                        request.code(),
                        request.name(),
                        request.description(),
                        request.permissionIds());
        return ResponseEntity.status(201).body(queries.get(id));
    }

    @PatchMapping("/{id}")
    public AdminRoleResponse update(
            @AuthenticationPrincipal Long actor,
            @PathVariable Long id,
            @Valid @RequestBody AdminRoleUpdateRequest request) {
        commands.update(actor, id, request.name(), request.description());
        return queries.get(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Long actor, @PathVariable Long id) {
        commands.delete(actor, id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/permissions")
    public AdminRoleResponse permissions(
            @AuthenticationPrincipal Long actor,
            @PathVariable Long id,
            @Valid @RequestBody AdminRolePermissionRequest request) {
        commands.replacePermissions(actor, id, request.permissionIds());
        return queries.get(id);
    }
}
