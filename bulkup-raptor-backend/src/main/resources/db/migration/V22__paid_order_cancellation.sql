ALTER TABLE orders ADD COLUMN paid_cancellation_pending BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ADD CONSTRAINT ck_orders_paid_cancellation_pending
    CHECK (NOT paid_cancellation_pending OR status = 'PAID');
ALTER TABLE payments DROP CONSTRAINT payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN ('READY', 'PAID', 'RETIRED', 'CANCELLED'));
ALTER TABLE stock_adjustments DROP CONSTRAINT ck_stock_adjustments_cause;
ALTER TABLE stock_adjustments ADD CONSTRAINT ck_stock_adjustments_cause CHECK (
    (cause = 'MANUAL_ADJUSTMENT' AND order_id IS NULL) OR
    (cause = 'ORDER_SALE' AND order_id IS NOT NULL AND delta < 0) OR
    (cause = 'ORDER_CANCELLATION' AND order_id IS NOT NULL AND delta > 0));
CREATE UNIQUE INDEX uk_stock_adjustments_order_cancellation ON stock_adjustments(order_id, product_id, cause)
    WHERE cause = 'ORDER_CANCELLATION';
