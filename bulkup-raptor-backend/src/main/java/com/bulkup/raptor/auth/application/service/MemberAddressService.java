package com.bulkup.raptor.auth.application.service;

import com.bulkup.raptor.auth.api.MemberAddressRequest;
import com.bulkup.raptor.auth.api.MemberAddressResponse;
import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.domain.MemberAddress;
import com.bulkup.raptor.auth.domain.MemberStatus;
import com.bulkup.raptor.auth.repository.MemberAddressRepository;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MemberAddressService {
    private final MemberRepository members;
    private final MemberAddressRepository addresses;

    @Transactional(readOnly = true)
    public List<MemberAddressResponse> list(Long memberId) {
        requireLogin(memberId);
        return addresses.findByMemberIdOrderByDefaultAddressDescIdAsc(memberId).stream().map(MemberAddressResponse::from).toList();
    }
    @Transactional
    public MemberAddressResponse create(Long memberId, MemberAddressRequest request) {
        var member = lockMember(memberId);
        var address = MemberAddress.forMember(member);
        update(address, request);
        if (request.defaultAddress() || addresses.findByMemberIdOrderByDefaultAddressDescIdAsc(memberId).isEmpty()) {
            clearDefault(memberId);
            address.setDefaultAddress(true);
        }
        return MemberAddressResponse.from(addresses.saveAndFlush(address));
    }
    @Transactional
    public MemberAddressResponse update(Long memberId, Long id, MemberAddressRequest request) {
        lockMember(memberId);
        var address = owned(memberId, id);
        update(address, request);
        // A current default stays default until another address is selected.
        if (request.defaultAddress() && !address.isDefaultAddress()) {
            clearDefault(memberId);
            address.setDefaultAddress(true);
        }
        return MemberAddressResponse.from(addresses.saveAndFlush(address));
    }
    @Transactional
    public MemberAddressResponse makeDefault(Long memberId, Long id) {
        lockMember(memberId);
        var address = owned(memberId, id);
        clearDefault(memberId);
        address.setDefaultAddress(true);
        return MemberAddressResponse.from(addresses.saveAndFlush(address));
    }
    @Transactional
    public void delete(Long memberId, Long id) {
        lockMember(memberId);
        var address = owned(memberId, id);
        boolean wasDefault = address.isDefaultAddress();
        addresses.delete(address);
        addresses.flush();
        if (wasDefault) addresses.findByMemberIdOrderByDefaultAddressDescIdAsc(memberId).stream().findFirst()
                .ifPresent(next -> next.setDefaultAddress(true));
    }
    private MemberAddress owned(Long memberId, Long id) {
        return addresses.findByIdAndMemberId(id, memberId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ADDRESS_NOT_FOUND));
    }
    private void clearDefault(Long memberId) {
        addresses.findByMemberIdAndDefaultAddressTrue(memberId).ifPresent(value -> value.setDefaultAddress(false));
        // Release the unique default index before assigning a new default.
        addresses.flush();
    }
    private Member lockMember(Long memberId) {
        requireLogin(memberId);
        return members.findByIdForUpdate(memberId).filter(value -> value.getStatus() == MemberStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_REQUIRED));
    }
    private void requireLogin(Long memberId) {
        if (memberId == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
    }
    private void update(MemberAddress address, MemberAddressRequest request) {
        address.update(request.label(), request.recipientName(), request.phone(), request.postalCode(), request.address(), request.addressDetail());
    }
}
