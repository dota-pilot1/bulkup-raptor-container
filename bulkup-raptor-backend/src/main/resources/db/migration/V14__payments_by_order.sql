-- 기존 결제 내역은 유지하고 요청 ID 저장만 제거한다.
ALTER TABLE payments DROP CONSTRAINT uk_payments_member_request;
ALTER TABLE payments DROP COLUMN request_id;

-- 현재 흐름은 주문 전체 금액에 대한 결제 한 건만 사용한다.
ALTER TABLE payments ADD CONSTRAINT uk_payments_order UNIQUE (order_id);
