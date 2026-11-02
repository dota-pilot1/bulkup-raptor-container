package com.bulkup.raptor.auth.api;

import com.bulkup.raptor.auth.domain.MemberAddress;

public record MemberAddressResponse(Long id, String label, String recipientName, String phone,
        String postalCode, String address, String addressDetail, boolean defaultAddress) {
    public static MemberAddressResponse from(MemberAddress address) {
        return new MemberAddressResponse(address.getId(), address.getLabel(), address.getRecipientName(),
                address.getPhone(), address.getPostalCode(), address.getAddress(), address.getAddressDetail(), address.isDefaultAddress());
    }
}
