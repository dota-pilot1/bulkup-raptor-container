package com.bulkup.raptor.inventory;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.mock;
import com.bulkup.raptor.inventory.domain.*;
import com.bulkup.raptor.product.domain.*;
import com.bulkup.raptor.order.domain.Order;
import com.bulkup.raptor.common.error.BusinessException;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class StockReservationTest {
    Product product() { return Product.create("상품", "설명", 1000, ProductCategory.SNACK, null, "X", 20); }

    @Test void confirmationIsIdempotentAndReleaseCannotFollowIt() {
        var p = product(); var now = Instant.now();
        var reservation = StockReservation.reserve(mock(Order.class), p, 3, now.plusSeconds(900));
        reservation.confirm(now); reservation.confirm(now.plusSeconds(1));
        assertThat(p.getStockQuantity()).isEqualTo(17);
        assertThat(p.getReservedQuantity()).isZero();
        assertThat(reservation.getConfirmedAt()).isEqualTo(now);
        assertThatThrownBy(() -> reservation.release(now)).isInstanceOf(BusinessException.class);
    }

    @Test void releaseIsIdempotentAndReleasedReservationCannotBeConfirmed() {
        var p = product(); var now = Instant.now();
        var reservation = StockReservation.reserve(mock(Order.class), p, 3, now.plusSeconds(900));
        reservation.requestRelease(now); reservation.requireReview(now); reservation.release(now);
        reservation.release(now.plusSeconds(1));
        assertThat(p.getStockQuantity()).isEqualTo(20);
        assertThat(p.getReservedQuantity()).isZero();
        assertThat(reservation.getReleasedAt()).isEqualTo(now);
        assertThatThrownBy(() -> reservation.confirm(now)).isInstanceOf(BusinessException.class);
    }

    @Test void paidResultCanConfirmWhileCancellationOrReviewIsPending() {
        var p = product(); var now = Instant.now();
        var reservation = StockReservation.reserve(mock(Order.class), p, 3, now.plusSeconds(900));
        reservation.requestRelease(now); reservation.requireReview(now); reservation.confirm(now);
        reservation.requireReview(now); reservation.requestRelease(now);
        assertThat(reservation.getStatus()).isEqualTo(StockReservationStatus.CONFIRMED);
        assertThat(p.getStockQuantity()).isEqualTo(17);
        assertThat(p.getReservedQuantity()).isZero();
    }
}
