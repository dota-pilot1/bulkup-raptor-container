CREATE TABLE member_default_deliveries (
    member_id BIGINT PRIMARY KEY REFERENCES members(id),
    recipient_name VARCHAR(80) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    postal_code VARCHAR(5) NOT NULL,
    address VARCHAR(200) NOT NULL,
    address_detail VARCHAR(200) NOT NULL
);
