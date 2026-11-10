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
  assert.equal(adminMenus.length, 8);
  assert.ok(adminMenus.some(menu => menu.id === 'payments'));
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

test('admin menu URLs and groups remain explicit, with payments on its dedicated route', () => {
  assert.equal(adminMenus.find(menu => menu.id === 'payments').href, '/admin/payments');
  assert.equal(adminMenus.find(menu => menu.id === 'products').href, '/admin/products');
  assert.equal(adminMenus.find(menu => menu.id === 'inventory').href, '/admin/inventory');
  assert.deepEqual(adminMenus.filter(menu => menu.group === 'sales').map(menu => menu.id), ['products', 'inventory', 'orders', 'payments']);
  assert.deepEqual(adminMenus.filter(menu => menu.group === 'members').map(menu => menu.id), ['members']);
  assert.equal(adminMenus.find(menu => menu.id === 'deliveries').href, '/admin/deliveries');
  assert.deepEqual(adminMenus.filter(menu => menu.group === 'delivery').map(menu => menu.id), ['deliveries']);
  assert.deepEqual(adminMenus.filter(menu => menu.group === 'access').map(menu => menu.id), ['roles', 'permissions']);
});

const dataUrl = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
function loadModule(path, imports) {
  let {outputText} = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX},
  });
  for (const [name, url] of Object.entries(imports)) outputText = outputText.replaceAll(`"${name}"`, `"${url}"`);
  return import(dataUrl(outputText));
}
const {default: React} = await import('react');
const {renderToStaticMarkup} = await import('react-dom/server');
const {AdminNavigation} = await loadModule('../src/components/admin/admin-navigation.tsx', {
  'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'),
  'next/link': dataUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))};export default function Link(p){return React.createElement('a',p)}`),
  '@/entities/session': dataUrl(outputText),
});
test('sidebar renders four named groups, the payment link and only one selected menu', () => {
  const html = renderToStaticMarkup(React.createElement(AdminNavigation, {activeTab: 'payments', productCount: 5}));
  for (const label of ['판매 운영', '배송 운영', '회원 운영', '접근 권한']) assert.ok(html.includes(label), label);
  assert.match(html, /href="\/admin\/payments" aria-current="page"/);
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
  assert.ok(!html.includes('/admin?tab=payments'));
  assert.match(html, /상품 관리/);
  assert.match(html, />5<\/span>/);
});
const {default: AdminPage} = await loadModule('../src/app/admin/page.tsx', {
  'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'),
  'next/navigation': dataUrl('export function redirect(url){throw new Error("REDIRECT:"+url)}'),
  '@/components/admin/admin-management': dataUrl('export function AdminManagement(){return null}'),
});
test('legacy payment tab redirects to payments while other existing admin tabs remain supported', async () => {
  await assert.rejects(AdminPage({searchParams: Promise.resolve({tab: 'payments'})}), /REDIRECT:\/admin\/payments/);
  await assert.rejects(AdminPage({searchParams: Promise.resolve({tab: 'orders'})}), /REDIRECT:\/admin\/orders/);
  await assert.rejects(AdminPage({searchParams: Promise.resolve({tab: 'inventory'})}), /REDIRECT:\/admin\/inventory/);
  await assert.rejects(AdminPage({searchParams: Promise.resolve({})}), /REDIRECT:\/admin\/products/);
  for (const tab of ['members', 'roles', 'permissions']) {
    const element = await AdminPage({searchParams: Promise.resolve({tab})});
    assert.equal(element.props.initialTab, tab);
  }
});
