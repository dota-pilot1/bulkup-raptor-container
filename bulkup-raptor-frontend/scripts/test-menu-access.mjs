import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/entities/session/model/admin-access.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { adminMenus, canAccessAdmin, accessibleAdminMenus, hasPermission, canManageAdminResource } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);
const member = (permissions, role = 'MEMBER') => ({ permissions, roles: [{ code: role }] });

test('one explicit admin entry permission exposes every admin menu', () => {
  const viewer = member(['MENU_ADMIN_ACCESS']);
  assert.equal(canAccessAdmin(viewer), true);
  assert.deepEqual(accessibleAdminMenus(viewer), adminMenus);
  assert.equal(adminMenus.length, 4);
});

test('retired menu permissions do not grant admin entry', () => {
  const viewer = member(['MENU_PRODUCT_ACCESS', 'MENU_MEMBER_ACCESS', 'MENU_ROLE_ACCESS', 'MENU_PERMISSION_ACCESS']);
  assert.equal(canAccessAdmin(viewer), false);
  assert.deepEqual(accessibleAdminMenus(viewer), []);
});

test('ADMIN and function permissions do not bypass menu permissions', () => {
  assert.deepEqual(accessibleAdminMenus(member(['PRODUCT_MANAGE', 'ROLE_MANAGE'], 'ADMIN')), []);
  assert.deepEqual(accessibleAdminMenus(null), []);
  assert.deepEqual(accessibleAdminMenus(undefined), []);
});

test('menu-only users do not acquire command permissions', () => {
  const viewer = member(['MENU_ADMIN_ACCESS']);
  assert.equal(hasPermission(viewer, 'PRODUCT_MANAGE'), false);
  assert.equal(canManageAdminResource(viewer, 'MEMBER_MANAGE'), false);
  assert.equal(canManageAdminResource(viewer, 'ROLE_MANAGE'), false);
});

test('restricted commands retain both the ADMIN role and their function permission', () => {
  assert.equal(canManageAdminResource(member(['MENU_ADMIN_ACCESS'], 'ADMIN'), 'MEMBER_MANAGE'), false);
  assert.equal(canManageAdminResource(member(['MEMBER_MANAGE']), 'MEMBER_MANAGE'), false);
  assert.equal(canManageAdminResource(member(['MEMBER_MANAGE'], 'ADMIN'), 'MEMBER_MANAGE'), true);
  assert.equal(hasPermission(member(['PRODUCT_MANAGE']), 'PRODUCT_MANAGE'), true);
});
