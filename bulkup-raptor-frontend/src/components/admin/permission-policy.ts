import type { RbacPermission, RbacRole } from "@/lib/api";

const adminOnly = new Set(["MEMBER_MANAGE", "MEMBER_ROLE_ASSIGN", "ROLE_MANAGE", "PERMISSION_MANAGE"]);
const operatorPermissions = new Set(["MENU_ADMIN_ACCESS", "PRODUCT_MANAGE", "ORDER_MANAGE", "SHIPPING_MANAGE"]);

export const fixedPermissions = (role: RbacRole) => role.systemRole && role.code !== "OPERATOR";

export function permissionRestriction(permission: RbacPermission, role?: RbacRole): string | null {
  if (role && fixedPermissions(role)) return "고정 권한";
  if (adminOnly.has(permission.code)) return "ADMIN 전용";
  if (role?.code === "OPERATOR" && !operatorPermissions.has(permission.code)) return "운영자 범위 밖의 권한";
  return null;
}
