package com.bulkup.raptor.auth.repository;

import com.bulkup.raptor.auth.domain.MemberAddress;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberAddressRepository extends JpaRepository<MemberAddress, Long> {
    List<MemberAddress> findByMemberIdOrderByDefaultAddressDescIdAsc(Long memberId);
    Optional<MemberAddress> findByIdAndMemberId(Long id, Long memberId);
    Optional<MemberAddress> findByMemberIdAndDefaultAddressTrue(Long memberId);
}
