package com.bulkup.raptor.admin.application.model;

import com.bulkup.raptor.auth.domain.MemberStatus;
import java.util.Locale;

public record MemberSearch(String pattern, MemberStatus status) {
    public static MemberSearch of(String search, MemberStatus status) {
        String query = search.trim().toLowerCase(Locale.ROOT);
        String pattern = query.isEmpty() ? null : "%" + query.replace("\\", "\\\\")
                .replace("%", "\\%").replace("_", "\\_") + "%";
        return new MemberSearch(pattern, status);
    }
}
