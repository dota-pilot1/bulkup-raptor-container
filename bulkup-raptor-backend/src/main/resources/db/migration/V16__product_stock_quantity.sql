-- 기존 상품은 재고 미입력 상태를 0으로 시작한다.
ALTER TABLE products
    ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 0;

ALTER TABLE products
    ADD CONSTRAINT ck_products_stock_quantity_nonnegative
    CHECK (stock_quantity >= 0);
