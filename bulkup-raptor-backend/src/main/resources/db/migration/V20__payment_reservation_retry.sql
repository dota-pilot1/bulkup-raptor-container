ALTER TABLE payments ADD COLUMN keep_order_on_release BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE payments DROP CONSTRAINT payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN ('READY', 'PAID', 'RETIRED'));
ALTER TABLE payments DROP CONSTRAINT uk_payments_order;
CREATE UNIQUE INDEX uk_payments_order_current ON payments (order_id) WHERE status <> 'RETIRED';
