package com.bulkup.raptor.auth.application.service;

import com.bulkup.raptor.auth.api.DefaultDeliveryRequest;
import com.bulkup.raptor.auth.api.DefaultDeliveryResponse;
import com.bulkup.raptor.auth.api.MemberAddressRequest;
import com.bulkup.raptor.auth.repository.MemberAddressRepository;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.auth.domain.MemberStatus;
import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Compatibility API backed by the address book. */
@Service
@RequiredArgsConstructor
public class DefaultDeliveryService {
    private final MemberRepository members;
    private final MemberAddressRepository addresses;
    private final MemberAddressService addressService;

    @Transactional(readOnly = true)
    public DefaultDeliveryResponse get(Long memberId) {
        if (memberId == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
        return addresses.findByMemberIdAndDefaultAddressTrue(memberId).map(DefaultDeliveryResponse::from).orElse(null);
    }
    @Transactional
    public DefaultDeliveryResponse save(Long memberId, DefaultDeliveryRequest request) {
        if (memberId == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
        members.findByIdForUpdate(memberId).filter(value -> value.getStatus() == MemberStatus.ACTIVE)
                .orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_REQUIRED));
        var current = addresses.findByMemberIdAndDefaultAddressTrue(memberId);
        var input = new MemberAddressRequest(current.map(value -> value.getLabel()).orElse("기본 배송지"),
                request.recipientName(), request.phone(), request.postalCode(), request.address(), request.addressDetail(), true);
        if (current.isPresent()) addressService.update(memberId, current.get().getId(), input);
        else addressService.create(memberId, input);
        return get(memberId);
    }
}
