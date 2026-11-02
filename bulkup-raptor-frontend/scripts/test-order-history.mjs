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
const apiUrl = dataUrl('export const calls=[];export class ApiError extends Error{};export async function apiFetch(path,init){calls.push({path,...init})}');
const api = await import(apiUrl);
const listApiUrl = moduleUrl('../src/entities/order/api/get-orders.ts', { '@/shared/api/client': apiUrl });
const {getOrders} = await import(listApiUrl);
const keysUrl = moduleUrl('../src/entities/order/model/order-query-keys.ts');
const {orderListKey, orderQueryKey} = await import(keysUrl);
test('order history API forwards pagination and abort signal; list keys isolate member and page from detail', async () => {
  const signal = new AbortController().signal;
  await getOrders(2, signal);
  assert.equal(api.calls[0].path, '/api/orders?page=2&size=20');
  assert.equal(api.calls[0].signal, signal);
  assert.deepEqual(orderListKey(4, 2), ['orders',4,'list',2]);
  assert.notDeepEqual(orderListKey(4, 2), orderListKey(5, 2));
  assert.notDeepEqual(orderListKey(4, 2), orderListKey(4, 1));
  assert.notDeepEqual(orderListKey(4, 2), orderQueryKey(4, 2));
});
const linkUrl = dataUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))};export default function Link({children,...props}){return React.createElement('a',props,children)}`);
const common = { react: import.meta.resolve('react'), 'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'), 'next/link': linkUrl, '@tanstack/react-query': import.meta.resolve('@tanstack/react-query') };
const historyUrl = moduleUrl('../src/entities/order/ui/order-history.tsx', common);
const {OrderHistory} = await import(historyUrl);
const order = {orderId:51,status:'CREATED',items:[{productName:'주문 당시 상품',quantity:2},{productName:'다른 상품',quantity:1}],totalAmount:117800,createdAt:'2026-10-29T16:30:00Z'};
test('history shows snapshot title, quantity, amount, unpaid status and Korean date with detail link', () => {
  const html = renderToString(React.createElement(OrderHistory,{orders:[order]})).replaceAll('<!-- -->', '');
  for (const text of ['주문 당시 상품','외 1종','총 3개','117,800','결제 전','2026년 10월 30일','href="/orders/51"']) assert.ok(html.includes(text),text);
  assert.ok(!html.includes('결제 완료'));
});
test('empty history offers shopping navigation', () => {
  const html=renderToString(React.createElement(OrderHistory,{orders:[]}));
  assert.match(html,/아직 주문 내역이 없어요/);
  assert.match(html,/href="\/"/);
});
const hookUrl = moduleUrl('../src/entities/order/model/use-orders.ts', { ...common, '../api/get-orders': listApiUrl, './order-query-keys': keysUrl });
const {default:Page}=await import(moduleUrl('../src/views/order-history/ui/order-history-page.tsx',{
  ...common,'@/widgets/header/ui/header':dataUrl('export const Header=()=>null'),
  '@/lib/api':dataUrl('export async function currentMember(){return null}'),
  '@/entities/order/model/use-orders':hookUrl,
  '@/entities/order/ui/order-history':historyUrl,
  '@/shared/api/client':apiUrl,
}));
function renderPage(member,pageData){
  const client=new QueryClient({defaultOptions:{queries:{gcTime:Infinity,staleTime:Infinity}}});
  client.setQueryData(['me'],member);
  if(member)client.setQueryData(orderListKey(member.id,0),pageData);
  return renderToString(React.createElement(QueryClientProvider,{client},React.createElement(Page)));
}
test('member history renders total and pagination for multiple pages',()=>{
  const html=renderPage({id:1},{content:[order],page:0,totalPages:2,totalElements:21});
  for(const text of ['21','주문 내역 페이지','이전','다음','1','주문 당시 상품'])assert.ok(html.includes(text),text);
});
test('anonymous history requests login instead of rendering private orders',()=>{
  const html=renderPage(null);
  assert.match(html,/로그인 후 주문 내역/);
  assert.match(html,/href="\/login"/);
  assert.ok(!html.includes('주문 당시 상품'));
});

const {useOrders}=await import(hookUrl);
function inspectHook(memberId,page=0){
  const client=new QueryClient({defaultOptions:{queries:{gcTime:Infinity,retry:false}}});
  let query;
  function Probe(){query=useOrders(memberId,page);return null;}
  renderToString(React.createElement(QueryClientProvider,{client},React.createElement(Probe)));
  return query;
}
test('order list hook disables requests for anonymous members and invalid pages',()=>{
  for(const [memberId,page] of [[null,0],[1,-1],[1,0.5],[1,NaN]]){
    const query=inspectHook(memberId,page);
    assert.equal(query.isEnabled,false);
    assert.equal(query.fetchStatus,'idle');
  }
  assert.equal(inspectHook(1,0).isEnabled,true);
});
