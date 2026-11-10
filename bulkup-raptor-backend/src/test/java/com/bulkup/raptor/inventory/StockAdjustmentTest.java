package com.bulkup.raptor.inventory;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.mock;

import com.bulkup.raptor.auth.domain.Member;
import com.bulkup.raptor.inventory.domain.StockAdjustment;
import com.bulkup.raptor.inventory.domain.StockAdjustmentType;
import com.bulkup.raptor.product.domain.Product;
import org.junit.jupiter.api.Test;

class StockAdjustmentTest {
    final Product product = mock(Product.class);
    final Member actor = mock(Member.class);

    @Test
    void derivesDirectionAndTrimsReason() {
        var increase = StockAdjustment.create(product, actor, 5, 10, 15, "  입고  ");
        var decrease = StockAdjustment.create(product, actor, -15, 15, 0, "폐기");
        assertThat(increase.getType()).isEqualTo(StockAdjustmentType.INCREASE);
        assertThat(increase.getReason()).isEqualTo("입고");
        assertThat(increase.getProduct()).isSameAs(product);
        assertThat(increase.getActor()).isSameAs(actor);
        assertThat(decrease.getType()).isEqualTo(StockAdjustmentType.DECREASE);
        assertThat(decrease.getAfterQuantity()).isZero();
    }

    @Test
    void rejectsZeroNegativeStockAndInconsistentQuantities() {
        for (int[] values : new int[][] {{0, 10, 10}, {-1, 0, -1}, {1, -1, 0}, {2, 10, 11}}) {
            assertThatIllegalArgumentException().isThrownBy(() ->
                    StockAdjustment.create(product, actor, values[0], values[1], values[2], "조정"));
        }
    }

    @Test
    void checksArithmeticWithoutIntegerOverflow() {
        assertThatIllegalArgumentException().isThrownBy(() ->
                StockAdjustment.create(product, actor, Integer.MAX_VALUE, 2, 1, "입고"));
        assertThat(StockAdjustment.create(product, actor, Integer.MAX_VALUE, 0, Integer.MAX_VALUE, "입고")
                .getAfterQuantity()).isEqualTo(Integer.MAX_VALUE);
    }

    @Test
    void rejectsMissingBlankAndLongReasons() {
        for (String reason : new String[] {null, "", "  ", "\u2003", "x".repeat(201)}) {
            assertThatIllegalArgumentException().isThrownBy(() ->
                    StockAdjustment.create(product, actor, 1, 0, 1, reason));
        }
        assertThat(StockAdjustment.create(product, actor, 1, 0, 1, "x".repeat(200)).getReason()).hasSize(200);
    }
}
