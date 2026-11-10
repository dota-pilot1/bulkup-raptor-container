-- Drivers open delivery screens only. Other admin reads stay on MENU_ADMIN_ACCESS.
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE code = 'DELIVERY_DRIVER')
  AND permission_id = (SELECT id FROM permissions WHERE code = 'MENU_ADMIN_ACCESS');

UPDATE roles
SET permission_version = permission_version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE code = 'DELIVERY_DRIVER';
