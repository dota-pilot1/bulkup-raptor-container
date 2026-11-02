ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('CREATED', 'PAID'));
ALTER TABLE payments DROP CONSTRAINT payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN ('READY', 'PAID'));
ALTER TABLE payments ADD COLUMN paid_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN transaction_id VARCHAR(200);
ALTER TABLE payments ADD COLUMN pg_tx_id VARCHAR(200);
ALTER TABLE payments ADD COLUMN payment_method VARCHAR(100);
ALTER TABLE payments ADD CONSTRAINT payments_paid_details_check
    CHECK (status <> 'PAID' OR (paid_at IS NOT NULL AND transaction_id IS NOT NULL));
CREATE UNIQUE INDEX uk_payments_order_paid ON payments (order_id) WHERE status = 'PAID';
