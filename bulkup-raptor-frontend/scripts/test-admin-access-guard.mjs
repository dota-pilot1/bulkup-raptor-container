import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
function moduleUrl(path, imports = {}) {
  let { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  for (const [name, replacement] of Object.entries(imports)) outputText = outputText.replaceAll(`"${name}"`, `"${replacement}"`);
  return dataUrl(outputText);
}
const queryUrl = dataUrl('export const state = { result: null, options: null }; export function useQuery(options) { state.options = options; return state.result; }');
const { state } = await import(queryUrl);
const navUrl = dataUrl('export const nav = { pathname: "/admin/products" }; export function usePathname() { return nav.pathname; } export function redirect(url) { throw new Error("REDIRECT:" + url); }');
const { nav } = await import(navUrl);
const accessUrl = moduleUrl('../src/entities/session/model/admin-access.ts');
const guardUrl = moduleUrl('../src/components/admin/admin-access-guard.tsx', {
  'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'),
  'next/link': dataUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))}; export default function Link(props) { return React.createElement('a', props); }`),
  'next/navigation': navUrl,
  '@tanstack/react-query': queryUrl,
  '@/entities/session': accessUrl,
  '@/lib/api': dataUrl('export async function currentMember() {}'),
});
const { AdminAccessGuard } = await import(guardUrl);
const authorized = { id: 7, permissions: ['MENU_ADMIN_ACCESS'], roles: [] };
const child = React.createElement('div', null, 'PRIVATE_ADMIN_CONTENT');
function result(overrides = {}) {
  state.result = { isPending: false, isFetchedAfterMount: true, isFetching: false, isError: false, data: authorized, refetch() {}, ...overrides };
}
const render = () => renderToStaticMarkup(AdminAccessGuard({ children: child }));

test('anonymous account result redirects to login before mounting admin children', () => {
  result({ data: null });
  assert.throws(render, /REDIRECT:\/login/);
});

test('pending account lookup never exposes protected content', () => {
  result({ isPending: true, data: undefined });
  const html = render();
  assert.match(html, /계정 확인 중/);
  assert.ok(!html.includes('PRIVATE_ADMIN_CONTENT'));
});

test('cached administrator must wait for fresh entry validation', () => {
  result({ isFetchedAfterMount: false, isFetching: true });
  assert.ok(!render().includes('PRIVATE_ADMIN_CONTENT'));
  result({ data: null });
  assert.throws(render, /REDIRECT:\/login/);
});

test('delivery driver enters only the delivery route', () => {
  const driver = { id: 9, permissions: ['DELIVERY_HANDLE'], roles: [{ code: 'DELIVERY_DRIVER' }] };
  result({ data: driver });
  nav.pathname = '/admin/products';
  assert.ok(!render().includes('PRIVATE_ADMIN_CONTENT'));
  nav.pathname = '/admin/deliveries';
  assert.match(render(), /PRIVATE_ADMIN_CONTENT/);
  nav.pathname = '/admin/products';
});

test('authenticated member without menu permission sees access denial', () => {
  result({ data: { ...authorized, permissions: [] } });
  const html = render();
  assert.match(html, /관리 권한이 필요/);
  assert.ok(!html.includes('PRIVATE_ADMIN_CONTENT'));
});

test('authorized administrator remains mounted during background account refresh', () => {
  result({ isFetching: true });
  assert.match(render(), /PRIVATE_ADMIN_CONTENT/);
});

test('network errors block children and offer retry instead of treating the user as anonymous', () => {
  result({ isError: true });
  const html = render();
  assert.match(html, /서버 연결/);
  assert.match(html, /다시 시도/);
  assert.ok(!html.includes('PRIVATE_ADMIN_CONTENT'));
});

const { default: AdminLayout } = await import(moduleUrl('../src/app/admin/layout.tsx', {
  'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'),
  '@/widgets/header/ui/header': dataUrl('export function Header() { return null; }'),
  '@/components/admin/admin-access-guard': guardUrl,
}));
test('shared admin layout guards its header and every nested page', () => {
  const layout = AdminLayout({ children: child });
  assert.equal(layout.type, AdminAccessGuard);
  assert.ok(layout.props.children.includes(child));
});
