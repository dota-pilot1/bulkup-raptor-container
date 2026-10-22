package com.bulkup.raptor.product.domain;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum ProductCategory {
    SUPPLEMENT("보충제"),
    SNACK("간식"),
    GEAR("운동용품"),
    STARTER_SET("스타터 세트");

    private final String label;
}
