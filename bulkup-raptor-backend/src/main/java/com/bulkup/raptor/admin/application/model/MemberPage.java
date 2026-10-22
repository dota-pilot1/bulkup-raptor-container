package com.bulkup.raptor.admin.application.model;

import java.util.List;

public record MemberPage(List<MemberSummary> content, int page, int size,
                         long totalElements, int totalPages, MemberStatistics statistics) {}
