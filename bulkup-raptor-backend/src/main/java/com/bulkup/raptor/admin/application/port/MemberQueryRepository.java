package com.bulkup.raptor.admin.application.port;

import com.bulkup.raptor.admin.application.model.MemberSearch;
import com.bulkup.raptor.admin.application.model.MemberSummary;
import com.bulkup.raptor.admin.application.model.MemberStatistics;
import java.util.List;

/** Read-only query port: no JPA or MyBatis types cross this boundary. */
public interface MemberQueryRepository {
    long count(MemberSearch search);
    List<MemberSummary> findMembers(MemberSearch search, int size, long offset);
    MemberStatistics statistics();
}
