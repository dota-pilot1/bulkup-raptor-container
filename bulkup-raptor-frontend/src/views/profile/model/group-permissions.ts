import type { MemberSession, MemberPermission } from "@/entities/session";

export function groupPermissions(account: MemberSession) {
  const permissionDetails = new Map(account.permissionDetails?.map((permission) => [permission.code, permission]));
  const permissions: MemberPermission[] = [...new Set(account.permissions)].map((code) =>
    permissionDetails.get(code) ?? { code, name: code, description: "" });
  const categories = new Map<string, { code: string; name: string; sortOrder: number; permissions: MemberPermission[] }>();
  for (const permission of permissions) {
    const code = permission.categoryCode ?? "OTHER";
    let category = categories.get(code);
    if (!category) {
      category = { code, name: permission.categoryName ?? "기타", sortOrder: permission.categorySortOrder ?? Number.MAX_SAFE_INTEGER, permissions: [] };
      categories.set(code, category);
    }
    category.permissions.push(permission);
  }
  const permissionGroups = [...categories.values()].sort((a, b) =>
    a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));

  return { permissions, permissionGroups };
}
