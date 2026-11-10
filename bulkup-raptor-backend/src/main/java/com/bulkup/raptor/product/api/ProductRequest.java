package com.bulkup.raptor.product.api;

import com.bulkup.raptor.product.domain.ProductCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.annotation.JsonDeserialize;

public record ProductRequest(
    @NotBlank(message = "상품명을 입력해 주세요.")
    @Size(max = 80, message = "상품명은 80자 이하로 입력해 주세요.")
    String name,

    @NotBlank(message = "설명을 입력해 주세요.")
    @Size(max = 200, message = "설명은 200자 이하로 입력해 주세요.")
    String description,

    @NotNull(message = "가격을 입력해 주세요.")
    @Positive(message = "가격은 1원 이상이어야 합니다.")
    Integer price,

    @NotNull(message = "카테고리를 선택해 주세요.")
    ProductCategory category,

    @Size(max = 12, message = "배지는 12자 이하로 입력해 주세요.")
    String badge,

    @NotBlank(message = "표시 이모지를 입력해 주세요.")
    @Size(max = 16, message = "표시 이모지는 16자 이하로 입력해 주세요.")
    String visual,

    @PositiveOrZero(message = "재고 수량은 0 이상이어야 합니다.")
    @JsonDeserialize(using = StockQuantityDeserializer.class)
    Integer stockQuantity
) {
    // 기존 내부 호출은 재고 없이 생성하며, 등록 서비스가 0으로 처리한다.
    public ProductRequest(String name, String description, Integer price, ProductCategory category,
            String badge, String visual) {
        this(name, description, price, category, badge, visual, null);
    }
}
