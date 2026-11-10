ALTER TABLE order_cancellation_history DROP CONSTRAINT IF EXISTS order_cancellation_history_actor_type_check;
ALTER TABLE order_cancellation_history ADD CONSTRAINT order_cancellation_history_actor_type_check
    CHECK (actor_type IN ('CUSTOMER', 'ADMIN', 'SYSTEM'));
