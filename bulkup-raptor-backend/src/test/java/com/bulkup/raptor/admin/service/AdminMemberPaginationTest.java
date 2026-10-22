package com.bulkup.raptor.admin.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.admin.application.service.AdminMemberQueryService;
import com.bulkup.raptor.admin.application.service.AdminMemberCommandService;
import com.bulkup.raptor.auth.domain.MemberStatus;
import com.bulkup.raptor.auth.repository.MemberRepository;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Transactional
class AdminMemberPaginationTest {
    @org.springframework.boot.test.web.server.LocalServerPort int port;
    @Autowired AdminMemberQueryService service;
    @Autowired AdminMemberCommandService commandService;
    @Autowired MemberRepository repository;
    @Autowired com.bulkup.raptor.role.repository.RoleRepository roleRepository;
    @Autowired JdbcTemplate jdbc;

    @Test
    void pagesFilteredResultsWithStableOrderingAndGlobalStatistics() {
        String prefix = "pagination-" + UUID.randomUUID();
        long originalTotal = repository.count();
        long originalPending = repository.countByStatus(MemberStatus.PENDING);
        long originalSuspended = repository.countByStatus(MemberStatus.SUSPENDED);
        for (int i = 0; i < 12; i++) {
            Member member = Member.pending(prefix + i + "@example.com", "hash", "Member " + i, Instant.now(), roleRepository.findByCode("MEMBER").orElseThrow());
            if (i == 11) member.updateStatus(MemberStatus.SUSPENDED);
            repository.saveAndFlush(member);
            jdbc.update("update members set created_at = ? where id = ?", java.sql.Timestamp.from(Instant.parse("2026-01-01T00:00:00Z")), member.getId());
        }
        var first = service.listMembers(0, 5, prefix.toUpperCase(), MemberStatus.PENDING);
        var second = service.listMembers(1, 5, prefix, MemberStatus.PENDING);
        var last = service.listMembers(2, 5, prefix, MemberStatus.PENDING);
        assertThat(first.totalElements()).isEqualTo(11);
        assertThat(first.totalPages()).isEqualTo(3);
        assertThat(first.content()).hasSize(5);
        assertThat(second.content()).hasSize(5);
        assertThat(last.content()).hasSize(1);
        assertThat(first.content().stream().map(m -> m.id()).toList())
                .doesNotContainAnyElementsOf(second.content().stream().map(m -> m.id()).toList());
        assertThat(first.content().getLast().id()).isGreaterThan(second.content().getFirst().id());
        assertThat(first.statistics().total()).isEqualTo(originalTotal + 12);
        assertThat(first.statistics().pending()).isEqualTo(originalPending + 11);
        assertThat(first.statistics().suspended()).isEqualTo(originalSuspended + 1);
        repository.findById(last.content().getFirst().id()).orElseThrow().updateStatus(MemberStatus.SUSPENDED);
        repository.flush();
        var clamped = service.listMembers(2, 5, prefix, MemberStatus.PENDING);
        assertThat(clamped.page()).isEqualTo(1);
        assertThat(clamped.totalElements()).isEqualTo(10);
        assertThat(clamped.content()).hasSize(5);
        var empty = service.listMembers(99, 5, prefix, MemberStatus.ACTIVE);
        assertThat(empty.page()).isZero();
        assertThat(empty.totalPages()).isZero();
        assertThat(empty.content()).isEmpty();
    }

    @Test
    void jpaStatusChangeIsVisibleToMyBatisAfterFlush() {
        String email = UUID.randomUUID() + "@example.com";
        Member member = repository.saveAndFlush(Member.pending(email, "hash", "Mixed persistence", Instant.now(), roleRepository.findByCode("MEMBER").orElseThrow()));
        assertThat(service.listMembers(0, 10, email, MemberStatus.PENDING).totalElements()).isEqualTo(1);
        commandService.updateMemberStatus(member.getId(), MemberStatus.ACTIVE);
        // MyBatis does not trigger JPA auto-flush: explicitly flush before querying inside one transaction.
        repository.flush();
        assertThat(service.listMembers(0, 10, email, MemberStatus.PENDING).content()).isEmpty();
        assertThat(service.listMembers(0, 10, email, MemberStatus.ACTIVE).content()).hasSize(1);
    }

    @Test
    void rejectsAnonymousAdminRequests() throws Exception {
        var client = java.net.http.HttpClient.newHttpClient();
        for (String query : new String[]{"page=-1", "size=0", "size=101", "status=INVALID", "page=abc"}) {
            var request = java.net.http.HttpRequest.newBuilder(java.net.URI.create("http://localhost:" + port + "/api/admin/members?" + query)).GET().build();
            assertThat(client.send(request, java.net.http.HttpResponse.BodyHandlers.discarding()).statusCode()).isEqualTo(401);
        }
    }

    @Test
    void searchesNamesAndTreatsWildcardsLiterally() {
        String name = "name-" + UUID.randomUUID() + "_%";
        repository.saveAndFlush(Member.pending(UUID.randomUUID() + "@example.com", "hash", name, Instant.now(), roleRepository.findByCode("MEMBER").orElseThrow()));
        assertThat(service.listMembers(0, 10, "  " + name.toUpperCase() + "  ", null).totalElements()).isEqualTo(1);
        assertThat(service.listMembers(0, 10, name.replace("_%", "xx"), null).content()).isEmpty();
        assertThat(service.listMembers(0, 10, "' OR 1=1 --", null).content()).isEmpty();
    }
}
