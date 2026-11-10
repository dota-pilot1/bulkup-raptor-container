package com.bulkup.raptor.inventory;

import static org.assertj.core.api.Assertions.*;
import com.bulkup.raptor.product.domain.*;
import com.bulkup.raptor.common.error.*;
import org.junit.jupiter.api.Test;

class ProductStockReservationTest {
    Product product() { return Product.create("상품", "설명", 1000, ProductCategory.SNACK, null, "X", 20); }

    @Test void reservationDoesNotReducePhysicalStock() {
        var p = product(); p.reserveStock(3);
        assertThat(p.getStockQuantity()).isEqualTo(20);
        assertThat(p.getReservedQuantity()).isEqualTo(3);
        assertThat(p.getAvailableQuantity()).isEqualTo(17);
    }
    @Test void confirmationConsumesHeldAndPhysicalStockTogether() {
        var p = product(); p.reserveStock(3); p.confirmStock(3);
        assertThat(p.getStockQuantity()).isEqualTo(17);
        assertThat(p.getReservedQuantity()).isZero();
    }
    @Test void releaseOnlyReturnsTheHold() {
        var p = product(); p.reserveStock(3); p.releaseStock(3);
        assertThat(p.getStockQuantity()).isEqualTo(20);
        assertThat(p.getReservedQuantity()).isZero();
    }
    @Test void protectsOtherOrdersHoldsAndRejectsOverbooking() {
        var p = product(); p.reserveStock(18);
        assertThatThrownBy(() -> p.reserveStock(3)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> p.adjustStock(-3)).isInstanceOf(BusinessException.class);
        assertThat(p.getStockQuantity()).isEqualTo(20);
        assertThat(p.getReservedQuantity()).isEqualTo(18);
    }
    @Test void invalidQuantitiesAndDoubleSettlementCannotMakeNegativeStock() {
        var p = product();
        assertThatThrownBy(() -> p.reserveStock(0)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> p.reserveStock(-1)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> p.confirmStock(1)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> p.releaseStock(1)).isInstanceOf(BusinessException.class);
        p.reserveStock(2); p.confirmStock(2);
        assertThatThrownBy(() -> p.confirmStock(2)).isInstanceOf(BusinessException.class);
    }
}
