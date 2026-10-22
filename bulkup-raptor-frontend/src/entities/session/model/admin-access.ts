import type { MemberSession } from "./types";

// 헤더의 관리자 링크와 관리자 화면 진입을 함께 제어하는 권한 코드이다.
export const ADMIN_MENU_PERMISSION = "MENU_ADMIN_ACCESS";

// 관리자 화면에 표시할 내부 메뉴 목록이다. 현재는 네 메뉴가 같은 접근 권한을 사용한다.
export const adminMenus = [
  { id: "products", label: "상품 관리", permission: ADMIN_MENU_PERMISSION },
  { id: "members", label: "회원 관리", permission: ADMIN_MENU_PERMISSION },
  { id: "roles", label: "역할 관리", permission: ADMIN_MENU_PERMISSION },
  { id: "permissions", label: "권한 관리", permission: ADMIN_MENU_PERMISSION },
] as const;

// 메뉴 ID만 추출한 타입이다. 선택 가능한 탭을 products | members | roles | permissions로 제한한다.
export type AdminTab = (typeof adminMenus)[number]["id"];

// 헤더와 관리자 화면에서 공통으로 사용하는 접근 검사이다. 회원의 권한을 설정하거나 변경하지 않는다.
export function canAccessAdmin(member: MemberSession | null | undefined) {
  return hasPermission(member, ADMIN_MENU_PERMISSION);
}

// 접근 권한이 있으면 내부 메뉴 전체를 반환하고, 없으면 빈 목록을 반환한다.
export function accessibleAdminMenus(member: MemberSession | null | undefined) {
  return canAccessAdmin(member) ? [...adminMenus] : [];
}

export function hasPermission(member: MemberSession | null | undefined, code: string) {
  return Boolean(member?.permissions.includes(code));
}

// Keep the backend's ADMIN-only command policy separate from menu visibility.
export function canManageAdminResource(member: MemberSession | null | undefined, code: string) {
  return Boolean(member?.roles.some((role) => role.code === "ADMIN")) && hasPermission(member, code);
}
