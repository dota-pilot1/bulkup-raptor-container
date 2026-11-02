package com.bulkup.raptor.auth.api;

import com.bulkup.raptor.auth.application.service.MemberAddressService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth/me/addresses")
@RequiredArgsConstructor
public class MemberAddressController {
    private final MemberAddressService addresses;
    @GetMapping
    public List<MemberAddressResponse> list(@AuthenticationPrincipal Long memberId) { return addresses.list(memberId); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public MemberAddressResponse create(@AuthenticationPrincipal Long memberId, @Valid @RequestBody MemberAddressRequest request) {
        return addresses.create(memberId, request);
    }
    @PutMapping("/{id}")
    public MemberAddressResponse update(@AuthenticationPrincipal Long memberId, @PathVariable Long id, @Valid @RequestBody MemberAddressRequest request) {
        return addresses.update(memberId, id, request);
    }
    @PatchMapping("/{id}/default")
    public MemberAddressResponse makeDefault(@AuthenticationPrincipal Long memberId, @PathVariable Long id) { return addresses.makeDefault(memberId, id); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Long memberId, @PathVariable Long id) { addresses.delete(memberId, id); }
}
