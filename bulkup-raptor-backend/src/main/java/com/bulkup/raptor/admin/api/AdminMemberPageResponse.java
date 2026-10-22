package com.bulkup.raptor.admin.api;

import java.util.List;
import com.bulkup.raptor.admin.application.model.MemberPage;

public record AdminMemberPageResponse(
        List<AdminMemberResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        Statistics statistics
) {
    public static AdminMemberPageResponse from(MemberPage page) {
        var statistics = page.statistics();
        return new AdminMemberPageResponse(page.content().stream().map(AdminMemberResponse::from).toList(),
                page.page(), page.size(), page.totalElements(), page.totalPages(),
                new Statistics(statistics.total(), statistics.active(), statistics.pending(), statistics.suspended()));
    }

    public record Statistics(long total, long active, long pending, long suspended) {}
}
