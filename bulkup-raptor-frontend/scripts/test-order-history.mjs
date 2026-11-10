import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
function moduleUrl(path, imports = {}, suffix = "") {
  let { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  for (const [name, url] of Object.entries(imports)) outputText = outputText.replaceAll(`"${name}"`, `"${url}"`);
  return dataUrl(outputText + suffix);
}
const apiUrl = dataUrl('export const calls=[];export class ApiError extends Error{};export async function apiFetch(path,init){calls.push({path,...init})}');
const api = await import(apiUrl);
const listApiUrl = moduleUrl('../src/entities/order/api/get-orders.ts', { '@/shared/api/client': apiUrl });
const {getOrders} = await import(listApiUrl);
const keysUrl = moduleUrl('../src/entities/order/model/order-query-keys.ts');
const {orderListKey, orderQueryKey, orderCountsKey} = await import(keysUrl);
test('order history API forwards pagination and abort signal; list keys isolate member and page from detail', async () => {
  const signal = new AbortController().signal;
  await getOrders(2, signal);
  assert.equal(api.calls[0].path, '/api/orders?page=2&size=20');
  assert.equal(api.calls[0].signal, signal);
  assert.deepEqual(orderListKey(4, 2), ['orders',4,'list','ALL',2]);
  assert.notDeepEqual(orderListKey(4, 2), orderListKey(5, 2));
  assert.notDeepEqual(orderListKey(4, 2), orderListKey(4, 1));
  assert.notDeepEqual(orderListKey(4, 2), orderQueryKey(4, 2));
});
const linkUrl = dataUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))};export default function Link({children,...props}){return React.createElement('a',props,children)}`);
const common = { '@/features/view-delivery/ui/order-delivery-button': dataUrl('export function OrderDeliveryButton(){return null}'), react: import.meta.resolve('react'), 'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'), 'next/link': linkUrl, '@tanstack/react-query': import.meta.resolve('@tanstack/react-query') };
const deadlineUrl = moduleUrl('../src/entities/order/ui/payment-deadline.tsx', common);
const historyUrl = moduleUrl('../src/entities/order/ui/order-history.tsx', { ...common, './payment-deadline': deadlineUrl });
const {OrderHistory} = await import(historyUrl);
const order = {orderId:51,status:'CREATED',items:[{productName:'주문 당시 상품',quantity:2},{productName:'다른 상품',quantity:1}],totalAmount:117800,createdAt:'2026-10-29T16:30:00Z'};
test('history shows snapshot title, quantity, amount, unpaid status and Korean date with detail link', () => {
  const html = renderToString(React.createElement(OrderHistory,{orders:[order]})).replaceAll('<!-- -->', '');
  for (const text of ['주문 당시 상품','외 1종','총 3개','117,800','결제 전','2026년 10월 30일','href="/orders/51"']) assert.ok(html.includes(text),text);
  assert.ok(!html.includes('결제 마감'));
  const reserved = renderToString(React.createElement(OrderHistory,{orders:[{...order,reservationExpiresAt:'2026-11-10T12:28:00Z'}]})).replaceAll('<!-- -->', '');
  assert.ok(reserved.includes('결제 마감'));
  assert.ok(reserved.includes('오후') || reserved.includes('PM') || reserved.includes('9:28') || reserved.includes('21:28'));
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
function renderPage(member,pageData,counts){
  const client=new QueryClient({defaultOptions:{queries:{gcTime:Infinity,staleTime:Infinity}}});
  client.setQueryData(['me'],member);
  if(member)client.setQueryData(orderListKey(member.id,0,'CREATED'),pageData);
  if(member && counts)client.setQueryData(orderCountsKey(member.id),counts);
  return renderToString(React.createElement(QueryClientProvider,{client},React.createElement(Page)));
}
test('member history renders total and pagination for multiple pages',()=>{
  const html=renderPage({id:1},{content:[order],page:0,totalPages:2,totalElements:21});
  for(const text of ['21','주문 내역 페이지','이전','다음','1','주문 당시 상품'])assert.ok(html.includes(text),text);
  assert.match(html,/id="orders-tab-CREATED" aria-selected="true"/);
  assert.ok(html.indexOf('id="orders-tab-CREATED"') < html.indexOf('id="orders-tab-ALL"'));
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


test('status filters travel to the server and partition cached pages',async()=>{
  for(const status of ['CREATED','PAID','CANCELLED']){
    const signal=new AbortController().signal;
    await getOrders(1,signal,status);
    assert.equal(api.calls.at(-1).path,`/api/orders?page=1&size=20&status=${status}`);
    assert.equal(api.calls.at(-1).signal,signal);
    assert.notDeepEqual(orderListKey(4,1,status),orderListKey(4,1));
  }
  assert.notDeepEqual(orderListKey(4,0,'PAID'),orderListKey(4,0,'CANCELLED'));
});

test('history keeps an explicit pending-cancellation badge and filtered empty message',()=>{
  const html=renderToString(React.createElement(OrderHistory,{orders:[{...order,cancellationPending:true}]}));
  assert.match(html,/취소 처리 중/);
  assert.match(renderToString(React.createElement(OrderHistory,{orders:[],emptyMessage:'취소한 주문이 없습니다.'})),/취소한 주문이 없습니다/);
});

test('tabs reset pagination and switch the server query, total count and empty message',async()=>{
  const stateUrl=dataUrl(`export let state={page:0,status:'ALL'};export function useState(){return [state,value=>{state=typeof value==='function'?value(state):value}];}`);
  const state=await import(stateUrl);
  const jsxUrl=dataUrl(`import * as runtime from '${import.meta.resolve('react/jsx-runtime')}';
    export const Fragment=runtime.Fragment;export let buttons=[];export const reset=()=>buttons=[];
    export function jsx(type,props,key){if(type==='button')buttons.push(props);return runtime.jsx(type,props,key);}
    export function jsxs(type,props,key){if(type==='button')buttons.push(props);return runtime.jsxs(type,props,key);}`);
  const jsx=await import(jsxUrl);
  const {MemberOrders}=await import(moduleUrl('../src/views/order-history/ui/order-history-page.tsx',{
    ...common,react:stateUrl,'react/jsx-runtime':jsxUrl,
    '@/widgets/header/ui/header':dataUrl('export const Header=()=>null'),
    '@/lib/api':dataUrl('export const currentMember=async()=>null'),
    '@/entities/order/model/use-orders':hookUrl,
    '@/entities/order/ui/order-history':historyUrl,'@/shared/api/client':apiUrl,
  },'\nexport { MemberOrders };'));
  const client=new QueryClient({defaultOptions:{queries:{gcTime:Infinity,staleTime:Infinity}}});
  client.setQueryData(orderListKey(4,0),{content:[order],totalPages:2,totalElements:21});
  client.setQueryData(orderListKey(4,1),{content:[{...order,orderId:52}],totalPages:2,totalElements:21});
  client.setQueryData(orderListKey(4,0,'PAID'),{content:[{...order,status:'PAID'}],totalPages:1,totalElements:1});
  client.setQueryData(orderListKey(4,0,'CANCELLED'),{content:[],totalPages:0,totalElements:0});
  const render=()=>{jsx.reset();return renderToString(React.createElement(QueryClientProvider,{client},React.createElement(MemberOrders,{memberId:4})));};
  render();jsx.buttons.find(x=>x.children==='다음').onClick();
  assert.equal(state.state.page,1);render();
  jsx.buttons.find(x=>x.id==='orders-tab-PAID').onClick();
  assert.deepEqual(state.state,{page:0,status:'PAID'});
  const paid=render();assert.match(paid,/aria-selected="true"/);assert.ok(!paid.includes('주문 내역 페이지'));
  assert.ok(!paid.includes('21'));
  jsx.buttons.find(x=>x.id==='orders-tab-CANCELLED').onClick();
  assert.deepEqual(state.state,{page:0,status:'CANCELLED'});assert.match(render(),/취소한 주문이 없습니다/);
  let focused=-1;const buttons=Array.from({length:4},(_,i)=>({focus(){focused=i;}}));
  jsx.buttons.find(x=>x.id==='orders-tab-CANCELLED').onKeyDown({key:'Home',preventDefault(){},currentTarget:{parentElement:{querySelectorAll:()=>buttons}}});
  assert.deepEqual(state.state,{page:0,status:'CREATED'});assert.equal(focused,0);
});


test('counts use server totals for all statuses with minimal page size and forward cancellation',async()=>{
  const mockUrl=dataUrl(`export const calls=[];export async function apiFetch(path,init){calls.push({path,signal:init.signal});const status=new URL(path,'http://localhost').searchParams.get('status');return {content:[{}],totalElements:{CREATED:43,PAID:7,CANCELLED:2}[status]};}`);
  const api=await import(mockUrl);
  const {getOrderCounts}=await import(moduleUrl('../src/entities/order/api/get-orders.ts',{'@/shared/api/client':mockUrl}));
  const signal=new AbortController().signal;
  assert.deepEqual(await getOrderCounts(signal),{CREATED:43,PAID:7,CANCELLED:2,ALL:52});
  assert.equal(api.calls.length,3);
  for(const call of api.calls){assert.match(call.path,/page=0&size=1&status=/);assert.equal(call.signal,signal);}
});

function tabText(html,status){
  const match=html.match(new RegExp('<button[^>]*id="orders-tab-'+status+'"[^]*?</button>'));
  assert.ok(match,'missing tab '+status);
  return match[0].replace(/<[^>]*>/g,'').replaceAll('<!-- -->','');
}
test('all tabs display state totals including zero independent of the current page size',()=>{
  const counts={CREATED:0,PAID:23,CANCELLED:2,ALL:25};
  const html=renderPage({id:1},{content:[],page:0,totalPages:0,totalElements:0},counts);
  for(const [status,count] of Object.entries(counts))assert.ok(tabText(html,status).includes(String(count)),status);
  assert.ok(tabText(html,'PAID').includes('23'));
  assert.ok(tabText(html,'CREATED').includes('0'));
});
test('unavailable counts show a placeholder instead of claiming zero and isolate accounts',()=>{
  const html=renderPage({id:1},{content:[],page:0,totalPages:0,totalElements:0});
  for(const status of ['CREATED','PAID','CANCELLED','ALL'])assert.ok(tabText(html,status).includes('—'));
  assert.notDeepEqual(orderCountsKey(1),orderCountsKey(2));
});
