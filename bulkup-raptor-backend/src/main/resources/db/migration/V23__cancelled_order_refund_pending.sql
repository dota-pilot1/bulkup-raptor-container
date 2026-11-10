ALTER TABLE orders DROP CONSTRAINT ck_orders_paid_cancellation_pending;
ALTER TABLE orders ADD CONSTRAINT ck_orders_paid_cancellation_pending
    CHECK (NOT paid_cancellation_pending OR status IN ('PAID', 'CANCELLED'));
