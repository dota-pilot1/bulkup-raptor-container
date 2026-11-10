package com.bulkup.raptor.product.api;

import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;

/** 재고 소수를 정수로 잘라 저장하거나 문자열을 숫자로 바꾸는 것을 막는다. */
public class StockQuantityDeserializer extends ValueDeserializer<Integer> {
    @Override
    public Integer deserialize(JsonParser parser, DeserializationContext context) {
        if (parser.currentToken() != JsonToken.VALUE_NUMBER_INT) {
            return context.reportInputMismatch(Integer.class, "재고 수량은 정수로 입력해야 합니다.");
        }
        // Integer 범위를 벗어나면 Jackson이 입력 오류로 처리한다.
        return parser.getIntValue();
    }
}
