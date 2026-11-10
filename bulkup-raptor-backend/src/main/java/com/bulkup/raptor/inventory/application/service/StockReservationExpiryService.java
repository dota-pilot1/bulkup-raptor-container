package com.bulkup.raptor.inventory.application.service;

import com.bulkup.raptor.inventory.repository.StockReservationRepository;
import com.bulkup.raptor.payment.application.service.CancelUnpaidPaymentService;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.stock.reservation.expiry.enabled", havingValue = "true", matchIfMissing = true)
public class StockReservationExpiryService {
    private static final Logger log = LoggerFactory.getLogger(StockReservationExpiryService.class);
    private final StockReservationRepository reservations;
    private final CancelUnpaidPaymentService cancellations;

    @Scheduled(fixedDelayString = "${app.stock.reservation.expiry.delay-ms:60000}", initialDelay = 60000)
    public void reconcileDue() {
        for (Long orderId : reservations.findDueOrderIds(Instant.now())) {
            try { cancellations.reconcileExpired(orderId); }
            catch (RuntimeException error) {
                // One failed order must not stop reconciliation of the remaining batch.
                log.warn("Inventory reconciliation failed: orderId={}, error={}", orderId, error.getClass().getSimpleName());
            }
        }
    }
}
