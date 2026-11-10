-- Drivers change delivery status. Shipping administration stays on SHIPPING_MANAGE.
INSERT INTO permissions (code, name, description, system_permission, category_id)
SELECT 'DELIVERY_HANDLE', '배송 처리', '배송 상태를 배송 중과 전달 완료로 변경', TRUE, id
FROM permission_categories WHERE code = 'ORDER_SHIPPING';

INSERT INTO roles (code, name, description, system_role)
VALUES ('DELIVERY_DRIVER', '배송 기사', '직접 배송의 상태를 변경한다', TRUE);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('MENU_ADMIN_ACCESS', 'DELIVERY_HANDLE')
WHERE r.code = 'DELIVERY_DRIVER';
