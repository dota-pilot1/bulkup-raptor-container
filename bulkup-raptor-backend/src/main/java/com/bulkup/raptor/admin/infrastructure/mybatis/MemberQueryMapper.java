package com.bulkup.raptor.admin.infrastructure.mybatis;

import com.bulkup.raptor.admin.application.model.MemberSearch;
import com.bulkup.raptor.admin.application.model.MemberStatistics;
import com.bulkup.raptor.admin.application.model.MemberSummary;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface MemberQueryMapper {
    long count(@Param("search") MemberSearch search);

    List<MemberSummary> findMembers(
            @Param("search") MemberSearch search,
            @Param("size") int size,
            @Param("offset") long offset);

    List<com.bulkup.raptor.admin.application.model.MemberRoleRow> findRoles(
            @Param("ids") List<Long> ids);

    MemberStatistics statistics();
}
