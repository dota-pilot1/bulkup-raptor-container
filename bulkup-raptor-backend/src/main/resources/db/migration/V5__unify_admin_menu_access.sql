-- One entry permission controls all admin screens. Command permissions stay unchanged.
INSERT INTO permissions (code, name, description, system_permission, category_id)
SELECT 'MENU_ADMIN_ACCESS', '관리자 페이지 접근',
       '관리자 페이지 진입과 상품·회원·역할·권한 목록 조회', TRUE, id
FROM permission_categories WHERE code = 'MENU_ACCESS';

-- Invalidate sessions of roles whose menu permissions will be replaced.
UPDATE roles r SET permission_version = permission_version + 1, updated_at = CURRENT_TIMESTAMP
WHERE EXISTS (
    SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = r.id AND p.code IN (
        'MENU_PRODUCT_ACCESS', 'MENU_MEMBER_ACCESS', 'MENU_ROLE_ACCESS', 'MENU_PERMISSION_ACCESS'
    )
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, target.id
FROM role_permissions rp
JOIN permissions previous ON previous.id = rp.permission_id
CROSS JOIN permissions target
WHERE previous.code IN ('MENU_PRODUCT_ACCESS', 'MENU_MEMBER_ACCESS', 'MENU_ROLE_ACCESS', 'MENU_PERMISSION_ACCESS')
  AND target.code = 'MENU_ADMIN_ACCESS'
ON CONFLICT (role_id, permission_id) DO NOTHING;

DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions WHERE code IN (
        'MENU_PRODUCT_ACCESS', 'MENU_MEMBER_ACCESS', 'MENU_ROLE_ACCESS', 'MENU_PERMISSION_ACCESS'
    )
);
DELETE FROM permissions
WHERE code IN ('MENU_PRODUCT_ACCESS', 'MENU_MEMBER_ACCESS', 'MENU_ROLE_ACCESS', 'MENU_PERMISSION_ACCESS');
