package com.bulkup.raptor.auth.service;

import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.auth.repository.MemberRepository;
import com.bulkup.raptor.role.repository.RoleRepository;
import java.time.Instant;
import java.util.ArrayList;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class DeliveryDriverSeed {
    public static final String EMAIL = "driver@bulkup.test";
    public static final String PASSWORD = "driver123";
    public static final String NAME = "배송기사";

    private final MemberRepository members;
    private final RoleRepository roles;
    private final PasswordEncoder passwordEncoder;

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void seed() {
        var role = roles.findByCode("DELIVERY_DRIVER").orElse(null);
        if (role == null) return;
        var existing = members.findByEmail(EMAIL);
        if (existing.isPresent()) {
            var member = existing.get();
            if (!member.hasRole("DELIVERY_DRIVER")) {
                var next = new ArrayList<>(member.getRoles());
                next.add(role);
                member.changeRoles(next);
            }
            return;
        }
        var member = Member.pending(EMAIL, passwordEncoder.encode(PASSWORD), NAME, Instant.now(), role);
        member.activateAfterEmailVerification();
        members.save(member);
    }
}
