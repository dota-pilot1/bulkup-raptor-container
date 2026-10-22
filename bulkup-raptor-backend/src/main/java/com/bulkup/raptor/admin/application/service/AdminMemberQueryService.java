package com.bulkup.raptor.admin.application.service;

import com.bulkup.raptor.admin.application.model.MemberSearch;
import com.bulkup.raptor.admin.application.model.MemberPage;
import com.bulkup.raptor.admin.application.port.MemberQueryRepository;
import com.bulkup.raptor.auth.domain.MemberStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminMemberQueryService {
    private final MemberQueryRepository repository;

    // 조회 전용 트랜잭션으로 실행한다. page와 size는 컨트롤러에서 검증한다.
    @Transactional(readOnly = true)
    public MemberPage listMembers(int page, int size, String search, MemberStatus status) {
        // 검색어를 정리하고, 건수와 목록 조회에 사용할 공통 검색 조건을 만든다.
        MemberSearch condition = MemberSearch.of(search, status);

        // 현재 페이지의 개수가 아니라 검색 조건에 맞는 전체 회원 수를 조회한다.
        long total = repository.count(condition);

        // 페이지당 개수로 나누어 페이지 수를 계산한다.
        int totalPages = (int) (total / size);

        // 남은 회원이 있으면 한 페이지를 추가한다.
        if (total % size > 0) {
            totalPages++;
        }

        // 마지막 페이지 번호를 구한다. 결과가 없으면 0을 사용한다.
        int lastPage = Math.max(0, totalPages - 1);

        // 요청한 번호가 마지막 번호를 넘지 않도록 한다.
        int actualPage = Math.min(page, lastPage);

        // 페이지 번호는 0부터 시작한다. 곱셈 전에 long으로 변환해 건너뛸 행 수를 계산한다.
        var content = repository.findMembers(condition, size, (long) actualPage * size);

        // 검색 조건과 무관한 전체 통계를 조회하고, 목록과 페이지 정보를 묶어 반환한다.
        return new MemberPage(content, actualPage, size, total, totalPages, repository.statistics());
    }
}
