-- UI navigation permissions are independent of command permissions.
INSERT INTO permission_categories (code, name, description, sort_order)
VALUES ('MENU_ACCESS', '메뉴 접근', '관리자 메뉴 진입과 목록 조회 권한', 0);

INSERT INTO permissions (code, name, description, system_permission, category_id)
SELECT seed.code, seed.name, seed.description, TRUE, category.id
FROM permission_categories category
CROSS JOIN (VALUES
    ('MENU_PRODUCT_ACCESS', '상품 관리 메뉴 접근', '상품 관리 화면 진입과 상품 목록 조회'),
    ('MENU_MEMBER_ACCESS', '회원 관리 메뉴 접근', '회원 관리 화면 진입과 회원 목록 조회'),
    ('MENU_ROLE_ACCESS', '역할 관리 메뉴 접근', '역할 관리 화면 진입과 역할·권한 목록 조회'),
    ('MENU_PERMISSION_ACCESS', '권한 관리 메뉴 접근', '권한 관리 화면 진입과 권한·분류 목록 조회')
) AS seed(code, name, description)
WHERE category.code = 'MENU_ACCESS';

-- Preserve existing navigation access. Ordinary members receive no admin menu access.
WITH added_links AS (
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT DISTINCT r.id, p.id
    FROM roles r
    CROSS JOIN permissions p
    WHERE p.code IN ('MENU_PRODUCT_ACCESS', 'MENU_MEMBER_ACCESS', 'MENU_ROLE_ACCESS', 'MENU_PERMISSION_ACCESS')
      AND (r.code = 'ADMIN' OR (
          p.code = 'MENU_PRODUCT_ACCESS'
          AND (r.code = 'OPERATOR' OR EXISTS (
              SELECT 1 FROM role_permissions rp
              JOIN permissions existing ON existing.id = rp.permission_id
              WHERE rp.role_id = r.id AND existing.code = 'PRODUCT_MANAGE'
          ))
      ))
    ON CONFLICT (role_id, permission_id) DO NOTHING
    RETURNING role_id
)
UPDATE roles SET permission_version = permission_version + 1, updated_at = CURRENT_TIMESTAMP
WHERE id IN (SELECT role_id FROM added_links);
