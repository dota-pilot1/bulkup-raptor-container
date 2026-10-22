import "server-only";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/server/database";
import { permissions, rolePermissions, roles, sessions, users } from "@/db/schema";

const SESSION_COOKIE = "bulkup_raptor_session";
const SESSION_DAYS = 7;

export async function createSession(userId: number) {
  const token = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86400000).toISOString();
  await db.insert(sessions).values({ token, userId, expiresAt, createdAt: now.toISOString() });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.PKT_STUDY_DESKTOP !== "1",
    expires: new Date(expiresAt),
    path: "/",
  });
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const result = await db.select({ user: users, role: roles, session: sessions }).from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id)).innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(sessions.token, token)).limit(1);
  const current = result[0];
  if (!current || new Date(current.session.expiresAt) <= new Date() || !current.user.active) return null;
  const grantedPermissions = await db.select({ code: permissions.code })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, current.role.id));
  return {
    id: current.user.id,
    email: current.user.email,
    username: current.user.username,
    role: { id: current.role.id, code: current.role.code, name: current.role.name },
    permissions: grantedPermissions.map((permission) => permission.code),
  };
}

export async function requireUser() {
  return getCurrentUser();
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.role.code === "ROLE_ADMIN" ? user : null;
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  cookieStore.delete(SESSION_COOKIE);
  if (token) await db.delete(sessions).where(eq(sessions.token, token));
}
