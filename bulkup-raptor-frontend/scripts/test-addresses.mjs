import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
function moduleUrl(path, imports = {}) {
  let { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  for (const [name, url] of Object.entries(imports)) outputText = outputText.replaceAll(`"${name}"`, `"${url}"`);
  return dataUrl(outputText);
}
const schemaUrl = moduleUrl('../src/entities/delivery/model/schema.ts', { zod: import.meta.resolve('zod') });
const { memberAddressSchema, deliveryInfo } = await import(schemaUrl);
const input = { label: '집', recipientName: '수령인', phone: '01012345678', postalCode: '06236', address: '서울시 테스트로', addressDetail: '101호', defaultAddress: true };
const calls = [];
const apiUrl = dataUrl('export const calls=[];export async function apiFetch(path,init){calls.push({path,...init});return undefined}');
const fakeApi = await import(apiUrl);
const addressApiUrl = moduleUrl('../src/entities/delivery/api/addresses.ts', { '@/shared/api/client': apiUrl });
const api = await import(addressApiUrl);
test('address API scopes keys by member and sends independent create, edit, default and delete commands', async () => {
  const signal = new AbortController().signal;
  await api.getAddresses(signal);
  await api.saveAddress(input);
  await api.saveAddress(input, 7);
  await api.makeDefaultAddress(7);
  await api.deleteAddress(7);
  calls.push(...fakeApi.calls);
  assert.deepEqual(api.addressesKey(4), ['addresses', 4]);
  assert.equal(calls[0].signal, signal);
  assert.deepEqual(calls.map(c => [c.path, c.method]), [
    ['/api/auth/me/addresses', undefined], ['/api/auth/me/addresses', 'POST'],
    ['/api/auth/me/addresses/7', 'PUT'], ['/api/auth/me/addresses/7/default', 'PATCH'], ['/api/auth/me/addresses/7', 'DELETE'],
  ]);
  assert.deepEqual(JSON.parse(calls[1].body), input);
});
test('address validation trims labels and shipping data; order delivery excludes address book metadata', () => {
  const saved = { ...input, id: 7, label: ' 집 ', recipientName: ' 수령인 ' };
  const parsed = memberAddressSchema.parse(saved);
  assert.equal(parsed.label, '집');
  assert.equal(parsed.recipientName, '수령인');
  assert.equal(memberAddressSchema.safeParse({ ...input, label: ' ' }).success, false);
  assert.equal(memberAddressSchema.safeParse({ ...input, label: 'a'.repeat(41) }).success, false);
  assert.equal(memberAddressSchema.safeParse({ ...input, postalCode: '1234' }).success, false);
  assert.deepEqual(deliveryInfo(saved), { recipientName: ' 수령인 ', phone: input.phone, postalCode: input.postalCode, address: input.address, addressDetail: input.addressDetail });
});
const reactImports = {
  react: import.meta.resolve('react'), 'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'),
  '@tanstack/react-query': import.meta.resolve('@tanstack/react-query'), 'react-hook-form': import.meta.resolve('react-hook-form'),
  '@hookform/resolvers/zod': import.meta.resolve('@hookform/resolvers/zod'),
  '@/entities/delivery/model/schema': schemaUrl, '@/entities/delivery/api/addresses': addressApiUrl,
  '@/entities/delivery/api/default-delivery': dataUrl('export const defaultDeliveryKey=id=>["default-delivery",id]'),
  '@/shared/ui/toast': dataUrl('export const useToast=()=>({success:()=>{}})'),
  '@/shared/ui/confirm-dialog': dataUrl('export const ConfirmDialog=()=>null'),
};
const { DefaultDeliverySettings } = await import(moduleUrl('../src/features/default-delivery/ui/default-delivery-settings.tsx', reactImports));
function render(addresses) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, staleTime: Infinity } } });
  client.setQueryData(api.addressesKey(1), addresses);
  return renderToString(React.createElement(QueryClientProvider, { client }, React.createElement(DefaultDeliverySettings, { memberId: 1 })));
}
test('profile renders multiple saved addresses, one default badge, and management actions', () => {
  const html = render([{ ...input, id: 1 }, { ...input, id: 2, label: '회사', defaultAddress: false, address: '회사 주소' }]);
  assert.match(html, /저장한 배송지/);
  assert.match(html, /회사 주소/);
  assert.match(html, /기본 배송지로 설정/);
  assert.equal((html.match(/>기본 배송지<\/span>/g) || []).length, 1);
  assert.equal((html.match(/>수정<\/button>/g) || []).length, 2);
  assert.equal((html.match(/>삭제<\/button>/g) || []).length, 2);
});
test('empty address book offers first address creation', () => {
  const html = render([]);
  assert.match(html, /첫 배송지는 기본 배송지/);
  assert.match(html, /배송지 추가/);
});
const orderSchemaUrl = moduleUrl('../src/features/create-order/model/order-form-schema.ts', { zod: import.meta.resolve('zod'), '@/entities/delivery/model/schema': schemaUrl });
const { OrderForm } = await import(moduleUrl('../src/features/create-order/ui/order-form.tsx', {
  ...reactImports,
  'next/navigation': dataUrl('export const useRouter=()=>({push:()=>{},replace:()=>{}})'),
  '@/entities/product/ui/product-visual': dataUrl('export const ProductVisual=()=>null'),
  '@/entities/order/model/order-amounts': moduleUrl('../src/entities/order/model/order-amounts.ts'),
  '../model/order-attempt-store': dataUrl('export const useOrderAttempt=()=>null'),
  '../model/use-create-order': dataUrl('export const useCreateOrder=()=>({isPending:false})'),
  '../model/order-form-schema': orderSchemaUrl,
}));
test('checkout renders every saved address and a direct input option', () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, staleTime: Infinity } } });
  client.setQueryData(api.addressesKey(1), [{ ...input, id: 1 }, { ...input, id: 2, label: '회사', defaultAddress: false }]);
  const html = renderToString(React.createElement(QueryClientProvider, { client }, React.createElement(OrderForm, { memberId: 1, cart: { items: [], totalAmount: 0 } })));
  assert.match(html, /order-address-choice/);
  assert.match(html, /직접 입력/);
  assert.match(html, /\[기본\] /);
  assert.match(html, /회사/);
  assert.match(html, /이번 주문에만 적용/);
});
