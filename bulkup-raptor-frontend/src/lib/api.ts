import type { Product, ProductInput } from "@/entities/product/model/product";

import { API_BASE_URL, apiFetch } from "@/shared/api/client";
import type { MemberRole, MemberSession } from "@/entities/session";

export { apiFetch } from "@/shared/api/client";
export type { MemberRole, MemberPermission, MemberSession } from "@/entities/session";

export type EmailVerificationConfirmResponse = {
  email: string;
  verificationToken: string;
  verified: boolean;
};

export function requestEmailVerification(email: string) {
  return apiFetch<void>("/api/auth/email-verifications", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function confirmEmailVerification(email: string, code: string) {
  return apiFetch<EmailVerificationConfirmResponse>("/api/auth/email-verifications/confirm", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export type SignupResponse = {
  id: number;
  email: string;
  name: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  emailVerified: boolean;
};

export function listProducts() {
  return apiFetch<Product[]>("/api/products");
}

export function createProduct(payload: ProductInput) {
  return apiFetch<Product>("/api/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProduct(id: number, payload: ProductInput) {
  return apiFetch<Product>(`/api/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteProduct(id: number) {
  return apiFetch<void>(`/api/products/${id}`, { method: "DELETE" });
}

export async function currentMember() {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: "include" });
  if (response.status === 401) return null;
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { detail?: string; message?: string } | null;
    throw new Error(error?.detail ?? error?.message ?? `API request failed: ${response.status}`);
  }
  return response.json() as Promise<MemberSession>;
}

export function logout() {
  return apiFetch<void>("/api/auth/logout", { method: "POST" });
}

export function signup(payload: {
  email: string;
  password: string;
  passwordConfirm: string;
  name: string;
  termsAgreed: boolean;
  privacyAgreed: boolean;
  emailVerificationToken: string;
}) {
  return apiFetch<SignupResponse>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type AdminMember = {
  id: number;
  email: string;
  name: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  emailVerified: boolean;
  createdAt: string;
  roles: MemberRole[];
};

export type AdminMemberPage = {
  content: AdminMember[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  statistics: { total: number; active: number; pending: number; suspended: number };
};

export function listAdminMembers(params: { page: number; size: number; search: string; status: string }) {
  const query = new URLSearchParams({ page: String(params.page), size: String(params.size), search: params.search });
  if (params.status !== "ALL") query.set("status", params.status);
  return apiFetch<AdminMemberPage>(`/api/admin/members?${query}`);
}

export function updateMemberStatus(id: number, status: "PENDING" | "ACTIVE" | "SUSPENDED") {
  return apiFetch<AdminMember>(`/api/admin/members/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function updateMemberRoles(id: number, roleIds: number[]) {
  return apiFetch<{ id: number; roles: MemberRole[] }>(`/api/admin/members/${id}/roles`, {
    method: "PATCH",
    body: JSON.stringify({ roleIds }),
  });
}


export type PermissionCategory = {
  id: number; code: string; name: string; description: string; sortOrder: number; permissionCount: number;
};
export type RbacPermission = {
  id: number; code: string; name: string; description: string;
  categoryId: number; categoryCode: string; categoryName: string;
  systemPermission: boolean; roleCount: number; roles: { id: number; code: string; name: string }[];
};
export type RbacRole = {
  id: number; code: string; name: string; description: string;
  systemRole: boolean; permissionVersion: number; permissions: RbacPermission[]; memberCount: number;
};
export type RbacInput = { code: string; name: string; description: string };
export const rbacApi = {
  roles: () => apiFetch<RbacRole[]>("/api/admin/roles"),
  permissions: (params?: { categoryId?: number; q?: string }) => {
    const query = new URLSearchParams();
    if (params?.categoryId) query.set("categoryId", String(params.categoryId));
    if (params?.q) query.set("q", params.q);
    return apiFetch<RbacPermission[]>(`/api/admin/permissions?${query}`);
  },
  categories: () => apiFetch<PermissionCategory[]>("/api/admin/permission-categories"),
  createCategory: (input: RbacInput & { sortOrder: number }) => apiFetch<PermissionCategory>("/api/admin/permission-categories", { method: "POST", body: JSON.stringify(input) }),
  updateCategory: (id: number, input: Pick<RbacInput, "name" | "description"> & { sortOrder: number }) => apiFetch<PermissionCategory>(`/api/admin/permission-categories/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteCategory: (id: number) => apiFetch<void>(`/api/admin/permission-categories/${id}`, { method: "DELETE" }),
  createRole: (input: RbacInput & { permissionIds: number[] }) => apiFetch<RbacRole>("/api/admin/roles", { method: "POST", body: JSON.stringify(input) }),
  updateRole: (id: number, input: Pick<RbacInput, "name" | "description">) => apiFetch<RbacRole>(`/api/admin/roles/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  setPermissions: (id: number, permissionIds: number[]) => apiFetch<RbacRole>(`/api/admin/roles/${id}/permissions`, { method: "PUT", body: JSON.stringify({ permissionIds }) }),
  deleteRole: (id: number) => apiFetch<void>(`/api/admin/roles/${id}`, { method: "DELETE" }),
  createPermission: (input: RbacInput & { categoryId: number }) => apiFetch<RbacPermission>("/api/admin/permissions", { method: "POST", body: JSON.stringify(input) }),
  updatePermission: (id: number, input: Pick<RbacInput, "name" | "description"> & { categoryId: number }) => apiFetch<RbacPermission>(`/api/admin/permissions/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deletePermission: (id: number) => apiFetch<void>(`/api/admin/permissions/${id}`, { method: "DELETE" }),
};
