import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
function moduleUrl(path, imports = {}) {
  let { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  for (const [name, target] of Object.entries(imports)) outputText = outputText.replaceAll(`"${name}"`, `"${target}"`);
  return url(outputText);
}
const apiUrl = url('export const calls=[];export async function apiFetch(path){calls.push(path)}');
const api = await import(apiUrl);
const paymentsUrl = moduleUrl('../src/entities/payment/api/get-admin-payments.ts', { '@/shared/api/client': apiUrl });
const { getAdminPayments } = await import(paymentsUrl);
test('payment API omits ALL filters and encodes search; false remains an explicit webhook filter', async () => {
  await getAdminPayments({ page: 0, size: 10, search: '', status: 'ALL', webhookVerified: 'ALL' });
  assert.equal(api.calls.at(-1), '/api/admin/payments?page=0&size=10&search=');
  await getAdminPayments({ page: 2, size: 50, search: 'payment_%&', status: 'PAID', webhookVerified: 'false' });
  const query = new URL(api.calls.at(-1), 'http://localhost').searchParams;
  assert.equal(query.get('search'), 'payment_%&');
  assert.equal(query.get('status'), 'PAID');
  assert.equal(query.get('webhookVerified'), 'false');
  assert.equal(query.get('page'), '2');
});
const common = { react: import.meta.resolve('react'), 'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'), '@tanstack/react-query': import.meta.resolve('@tanstack/react-query') };
const sessionUrl = moduleUrl('../src/entities/session/model/admin-access.ts');
const { PaymentManagement } = await import(moduleUrl('../src/components/admin/payment-management.tsx', {
  ...common,
  'next/link': url(`import React from ${JSON.stringify(import.meta.resolve('react'))};export default function Link(p){return React.createElement('a',p)}`),
  '@/lib/api': url('export async function currentMember(){return null}'),
  '@/entities/session': sessionUrl,
  '@/entities/payment/api/get-admin-payments': paymentsUrl,
  '@/components/admin/admin-navigation': url('export const AdminNavigation=()=>null'),
  '@/components/ui/badge': moduleUrl('../src/components/ui/badge.tsx', common),
  '@/components/ui/select': url('export const Select=()=>null'),
  '@/components/ui/search-filter-bar': moduleUrl('../src/components/ui/search-filter-bar.tsx', common),
}));
const filters = { search: '', status: 'ALL', webhookVerified: 'ALL' };
const row = { orderId: 153, paymentId: 'payment-admin-test', totalAmount: 5400, currency: 'KRW', paymentMethod: 'PaymentMethodEasyPay', status: 'PAID', createdAt: '2026-11-01T01:00:00Z', paidAt: '2026-11-01T01:01:00Z', webhookVerifiedAt: null };
function render(member, content) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, staleTime: Infinity } } });
  client.setQueryData(['me'], member);
  client.setQueryData(['admin-payments', member?.id, 0, 10, filters], { content, page: 0, size: 10, totalPages: 2, totalElements: 11 });
  return renderToString(React.createElement(QueryClientProvider, { client }, React.createElement(PaymentManagement))).replaceAll('<!-- -->', '');
}
const viewer = { id: 1, roles: [{ code: 'MEMBER' }], permissions: ['MENU_ADMIN_ACCESS'] };
test('menu-only viewer sees saved payment data and separate webhook status with pagination', () => {
  const html = render(viewer, [row]);
  for (const value of ['153', 'payment-admin-test', '5,400 KRW', 'PaymentMethodEasyPay', '결제 완료', '미확인', '검색 결과 11건', '1 / 2 페이지', '결제 목록 페이지 이동']) assert.ok(html.includes(value), value);
  assert.ok(!html.includes('Invalid Date'));
});
test('ready payments display unknown method and missing paid date without implying success', () => {
  const html = render(viewer, [{ ...row, status: 'READY', paymentMethod: null, paidAt: null }]);
  assert.ok(html.includes('미확정'));
  assert.ok(html.includes('—'));
  assert.ok(!html.includes('>결제 완료<'));
});
test('anonymous and non-menu sessions cannot display cached private payment data', () => {
  for (const member of [null, { id: 2, roles: [{ code: 'ADMIN' }], permissions: [] }]) {
    const html = render(member, [row]);
    assert.ok(html.includes('관리 권한이 필요해요'));
    assert.ok(!html.includes('payment-admin-test'));
  }
});
test('empty response displays search empty state', () => {
  assert.ok(render(viewer, []).includes('조건에 일치하는 결제가 없습니다.'));
});
