package com.bulkup.raptor.permission.application.service;

import com.bulkup.raptor.admin.api.AdminPermissionCategoryResponse;
import com.bulkup.raptor.common.error.*;
import com.bulkup.raptor.permission.repository.*;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PermissionCategoryQueryService {
    private final PermissionCategoryRepository categories;
    private final PermissionRepository permissions;

    public List<AdminPermissionCategoryResponse> list() {
        var counts =
                permissions.categoryCounts().stream()
                        .collect(
                                Collectors.toMap(
                                        PermissionRepository.CategoryCount::getCategoryId,
                                        PermissionRepository.CategoryCount::getTotal));
        return categories.findAllByOrderBySortOrderAscIdAsc().stream()
                .map(
                        c ->
                                AdminPermissionCategoryResponse.from(
                                        c, counts.getOrDefault(c.getId(), 0L)))
                .toList();
    }

    public AdminPermissionCategoryResponse get(Long id) {
        var c =
                categories
                        .findById(id)
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                ErrorCode.PERMISSION_CATEGORY_NOT_FOUND));
        return AdminPermissionCategoryResponse.from(c, permissions.countByCategoryId(id));
    }
}
