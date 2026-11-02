CREATE TABLE payments (
    payment_id VARCHAR(64) PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    member_id BIGINT NOT NULL REFERENCES members(id),
    request_id UUID NOT NULL,
    order_name VARCHAR(120) NOT NULL,
    total_amount BIGINT NOT NULL CHECK (total_amount >= 0),
    currency VARCHAR(3) NOT NULL CHECK (currency = 'KRW'),
    status VARCHAR(20) NOT NULL CHECK (status = 'READY'),
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uk_payments_member_request UNIQUE (member_id, request_id)
);

-- 이력은 여러 건을 허용하지만 준비 중인 결제는 주문당 하나만 허용한다.
CREATE UNIQUE INDEX uk_payments_order_ready ON payments (order_id) WHERE status = 'READY';
