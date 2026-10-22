package com.bulkup.raptor.admin.infrastructure.mybatis;

import com.bulkup.raptor.admin.application.model.MemberSearch;
import com.bulkup.raptor.admin.application.model.MemberStatistics;
import com.bulkup.raptor.admin.application.model.MemberSummary;
import com.bulkup.raptor.admin.application.port.MemberQueryRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
@RequiredArgsConstructor
public class MyBatisMemberQueryRepository implements MemberQueryRepository {
    private final MemberQueryMapper mapper;

    @Override
    public long count(MemberSearch search) {
        return mapper.count(search);
    }

    @Override
    public List<MemberSummary> findMembers(MemberSearch search, int size, long offset) {
        var page = mapper.findMembers(search, size, offset);
        if (page.isEmpty()) return page;
        var grouped =
                mapper.findRoles(page.stream().map(MemberSummary::id).toList()).stream()
                        .collect(
                                java.util.stream.Collectors.groupingBy(
                                        com.bulkup.raptor.admin.application.model.MemberRoleRow
                                                ::memberId,
                                        java.util.stream.Collectors.mapping(
                                                row ->
                                                        new com.bulkup.raptor.auth.api
                                                                .MemberRoleResponse(
                                                                row.id(), row.code(), row.name()),
                                                java.util.stream.Collectors.toList())));
        return page.stream()
                .map(member -> member.withRoles(grouped.getOrDefault(member.id(), List.of())))
                .toList();
    }

    @Override
    public MemberStatistics statistics() {
        return mapper.statistics();
    }
}
