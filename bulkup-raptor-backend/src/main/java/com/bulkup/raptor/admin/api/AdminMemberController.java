package com.bulkup.raptor.admin.api;

import com.bulkup.raptor.admin.application.service.AdminMemberCommandService;
import com.bulkup.raptor.admin.application.service.AdminMemberQueryService;
import com.bulkup.raptor.auth.application.service.ChangeMemberRoleService;
import com.bulkup.raptor.auth.domain.MemberStatus;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import lombok.RequiredArgsConstructor;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/members")
@RequiredArgsConstructor
public class AdminMemberController {

    private final AdminMemberCommandService commandService;
    private final AdminMemberQueryService queryService;
    private final ChangeMemberRoleService changeMemberRoleService;

    @PatchMapping("/{id}/role")
    public AdminMemberRoleResponse changeRole(
            @AuthenticationPrincipal Long actorId,
            @PathVariable Long id,
            @Valid @RequestBody AdminMemberRoleRequest request) {
        var member = changeMemberRoleService.changeRole(actorId, id, request.roleId());
        return AdminMemberRoleResponse.from(member);
    }

    @PatchMapping("/{id}/roles")
    public AdminMemberRoleResponse changeRoles(
            @AuthenticationPrincipal Long actorId,
            @PathVariable Long id,
            @Valid @RequestBody AdminMemberRolesRequest request) {
        return AdminMemberRoleResponse.from(
                changeMemberRoleService.changeRoles(actorId, id, request.roleIds()));
    }

    @GetMapping
    public AdminMemberPageResponse listMembers(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int size,
            @RequestParam(defaultValue = "") String search,
            @RequestParam(required = false) MemberStatus status) {
        return AdminMemberPageResponse.from(queryService.listMembers(page, size, search, status));
    }

    @PatchMapping("/{id}/status")
    public AdminMemberResponse updateMemberStatus(
            @PathVariable Long id, @Valid @RequestBody AdminMemberStatusRequest request) {
        return AdminMemberResponse.from(commandService.updateMemberStatus(id, request.status()));
    }
}
