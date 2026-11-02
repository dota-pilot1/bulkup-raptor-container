package com.bulkup.raptor.auth.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "member_addresses")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MemberAddress {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false) private Member member;
    @Column(nullable = false, length = 40) private String label;
    @Column(name = "recipient_name", nullable = false, length = 80) private String recipientName;
    @Column(nullable = false, length = 30) private String phone;
    @Column(name = "postal_code", nullable = false, length = 5) private String postalCode;
    @Column(nullable = false, length = 200) private String address;
    @Column(name = "address_detail", nullable = false, length = 200) private String addressDetail;
    @Column(name = "default_address", nullable = false) private boolean defaultAddress;

    public static MemberAddress forMember(Member member) {
        var address = new MemberAddress();
        address.member = member;
        return address;
    }
    public void update(String label, String recipientName, String phone, String postalCode, String address, String addressDetail) {
        this.label = label.trim();
        this.recipientName = recipientName.trim();
        this.phone = phone.trim();
        this.postalCode = postalCode.trim();
        this.address = address.trim();
        this.addressDetail = addressDetail.trim();
    }
    public void setDefaultAddress(boolean value) { this.defaultAddress = value; }
}
