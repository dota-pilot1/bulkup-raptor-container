package com.bulkup.raptor.auth.repository;

import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.domain.MemberStatus;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MemberRepository extends JpaRepository<Member, Long> {
    long countByStatus(MemberStatus status);

    boolean existsByEmail(String email);

    @EntityGraph(attributePaths = "roles")
    Optional<Member> findByEmail(String email);

    @Override
    @EntityGraph(attributePaths = "roles")
    Optional<Member> findById(Long id);

    @Query("select count(m) from Member m join m.roles r where r.id = :roleId")
    long countByRoleId(@Param("roleId") Long roleId);

    // 회원만 ID 순서로 잠근다. 역할은 서비스에서 이후에 잠가 잠금 순서를 유지한다.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Member m where m.id in (:actorId, :targetId) order by" + " m.id")
    List<Member> lockRoleChangeMembers(
            @Param("actorId") Long actorId, @Param("targetId") Long targetId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Member m where m.id = :id")
    Optional<Member> findByIdForUpdate(@Param("id") Long id);

    @Query(
            "select m.sessionVersion as sessionVersion, m.status as status, r.id as roleId,"
                    + " r.code as roleCode, r.permissionVersion as permissionVersion"
                    + " from Member m left join m.roles r where m.id = :id")
    List<SessionState> findSessionState(@Param("id") Long id);

    @Query(
            "select r.id as roleId, count(m) as total from Member m join m.roles r"
                    + " where r.id in :ids group by r.id")
    List<RoleMemberCount> countRoleMembers(@Param("ids") java.util.Collection<Long> ids);

    interface RoleMemberCount {
        Long getRoleId();

        long getTotal();
    }

    interface SessionState {
        long getSessionVersion();

        MemberStatus getStatus();

        Long getRoleId();

        String getRoleCode();

        Long getPermissionVersion();
    }
}
