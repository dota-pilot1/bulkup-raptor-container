package com.bulkup.raptor.inventory;

import static org.assertj.core.api.Assertions.*;

import com.bulkup.raptor.common.error.BusinessException;
import com.bulkup.raptor.common.error.ErrorCode;
import com.bulkup.raptor.product.domain.Product;
import com.bulkup.raptor.product.domain.ProductCategory;
import org.junit.jupiter.api.Test;

class ProductStockAdjustmentTest {
    Product product(int stock) {
        return Product.create("상품", "설명", 1000, ProductCategory.SUPPLEMENT, null, "X", stock);
    }

    @Test
    void increasesDecreasesAndAllowsZeroStock() {
        var product = product(10);
        product.adjustStock(5);
        assertThat(product.getStockQuantity()).isEqualTo(15);
        product.adjustStock(-15);
        assertThat(product.getStockQuantity()).isZero();
    }

    @Test
    void rejectsZeroWithoutChangingStock() {
        var product = product(10);
        assertThatThrownBy(() -> product.adjustStock(0)).isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_INPUT);
        assertThat(product.getStockQuantity()).isEqualTo(10);
    }

    @Test
    void rejectsUnderflowIncludingMinimumInteger() {
        var product = product(10);
        for (int delta : new int[]{-11, Integer.MIN_VALUE}) {
            assertThatThrownBy(() -> product.adjustStock(delta)).isInstanceOf(BusinessException.class)
                    .extracting("errorCode").isEqualTo(ErrorCode.STOCK_INSUFFICIENT);
            assertThat(product.getStockQuantity()).isEqualTo(10);
        }
    }

    @Test
    void checksOverflowWithoutWrappingAndAllowsMaximum() {
        var product = product(0);
        product.adjustStock(Integer.MAX_VALUE);
        assertThatThrownBy(() -> product.adjustStock(1)).isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.STOCK_QUANTITY_OUT_OF_RANGE);
        assertThat(product.getStockQuantity()).isEqualTo(Integer.MAX_VALUE);
        product.adjustStock(-Integer.MAX_VALUE);
        assertThat(product.getStockQuantity()).isZero();
    }
}
