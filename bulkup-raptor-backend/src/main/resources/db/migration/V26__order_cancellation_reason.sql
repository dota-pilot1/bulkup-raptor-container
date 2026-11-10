ALTER TABLE orders ADD COLUMN cancellation_reason VARCHAR(200);
DROP TABLE IF EXISTS order_cancellation_history;
