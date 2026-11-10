package com.bulkup.raptor.admin.application.service;

import com.bulkup.raptor.admin.api.AdminPaymentPageResponse;
import com.bulkup.raptor.payment.domain.Payment;
import com.bulkup.raptor.payment.domain.PaymentStatus;
import com.bulkup.raptor.payment.repository.PaymentRepository;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminPaymentQueryService {
    private final PaymentRepository payments;

    @Transactional(readOnly = true)
    public AdminPaymentPageResponse list(int page, int size, String search, PaymentStatus status, Boolean webhookVerified) {
        String term = search.trim().toLowerCase(Locale.ROOT);
        Specification<Payment> condition = (root, query, builder) -> {
            var predicates = new ArrayList<Predicate>();
            if (!term.isEmpty()) {
                // 검색에 포함된 %, _도 일반 문자로 처리한다. 주문 번호는 정확히 일치시킨다.
                String escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
                Predicate match = builder.like(builder.lower(root.get("paymentId")), "%" + escaped + "%", '\\');
                try {
                    long orderId = Long.parseLong(term);
                    match = builder.or(match, builder.equal(root.get("order").get("id"), orderId));
                } catch (NumberFormatException ignored) {
                    // 숫자가 아니거나 Long 범위를 넘는 검색어는 결제 ID만 검색한다.
                }
                predicates.add(match);
            }
            if (status != null) predicates.add(builder.equal(root.get("status"), status));
            if (webhookVerified != null) predicates.add(webhookVerified
                    ? builder.isNotNull(root.get("webhookVerifiedAt")) : builder.isNull(root.get("webhookVerifiedAt")));
            return builder.and(predicates.toArray(Predicate[]::new));
        };
        var sort = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("paymentId"));
        // JPA의 int offset 범위를 넘는 요청도 실제 마지막 페이지로 보정한 뒤 조회한다.
        long total = payments.count(condition);
        int lastPage = (int) Math.min(Integer.MAX_VALUE / size, total == 0 ? 0 : (total - 1) / size);
        var result = payments.findAll(condition, PageRequest.of(Math.min(page, lastPage), size, sort));
        return new AdminPaymentPageResponse(result.getContent().stream().map(AdminPaymentPageResponse.Item::from).toList(),
                result.getNumber(), size, result.getTotalPages(), result.getTotalElements());
    }
}
