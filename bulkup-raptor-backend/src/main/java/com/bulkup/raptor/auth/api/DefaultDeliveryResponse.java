package com.bulkup.raptor.auth.api;

import com.bulkup.raptor.auth.domain.MemberAddress;

public record DefaultDeliveryResponse(
        String recipientName, String phone, String postalCode, String address, String addressDetail) {
    public static DefaultDeliveryResponse from(MemberAddress delivery) {
        return new DefaultDeliveryResponse(delivery.getRecipientName(), delivery.getPhone(),
                delivery.getPostalCode(), delivery.getAddress(), delivery.getAddressDetail());
    }
}
