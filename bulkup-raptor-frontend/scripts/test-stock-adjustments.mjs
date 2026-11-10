import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
function moduleUrl(path, imports = {}) {
  let { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  for (const [name, target] of Object.entries(imports)) outputText = outputText.replaceAll(`"${name}"`, `"${target}"`);
  return url(outputText);
}
const apiUrl = moduleUrl('../src/shared/api/client.ts');
const { ApiError } = await import(apiUrl);
const getUrl = moduleUrl('../src/entities/inventory/api/get-stock-adjustments.ts', { '@/shared/api/client': apiUrl });
const { getStockAdjustments } = await import(getUrl);
const fixture = { id: 3, productId: 670, actorId: 8, actorName: '재고 담당자', type: 'DECREASE', delta: -2, beforeQuantity: 12, afterQuantity: 10, reason: '파손 확인\n폐기 처리', createdAt: '2026-11-03T01:00:00Z' };
const pageData = (content = [fixture], overrides = {}) => ({ content, page: 0, size: 10, totalElements: 11, totalPages: 2, ...overrides });
test('API passes pagination, credentials and signal and preserves response fields', async () => {
  const original = globalThis.fetch;
  const signal = new AbortController().signal;
  let call;
  globalThis.fetch = async (path, init) => { call = { path, init }; return new Response(JSON.stringify(pageData())); };
  try {
    assert.deepEqual(await getStockAdjustments(670, 2, 10, signal), pageData());
    const path = new URL(call.path);
    assert.equal(path.pathname, '/api/admin/products/670/stock-adjustments');
    assert.equal(path.search, '?page=2&size=10');
    assert.equal(call.init.signal, signal);
    assert.equal(call.init.credentials, 'include');
  } finally { globalThis.fetch = original; }
});
test('API preserves server status for authorization and missing products', async () => {
  const original = globalThis.fetch;
  try {
    for (const status of [401, 403, 404, 500]) {
      globalThis.fetch = async () => new Response(JSON.stringify({ detail: 'test' }), { status });
      await assert.rejects(getStockAdjustments(670, 0, 10), error => error instanceof ApiError && error.status === status);
    }
  } finally { globalThis.fetch = original; }
});
const reactMock = url(`export * from ${JSON.stringify(import.meta.resolve('react'))};export let page=0;export function reset(value=0){page=value} export function useState(){return [page,value=>{page=typeof value==='function'?value(page):value}]}`);
const state = await import(reactMock);
const queryMock = url('export let options;export let result;export function setResult(value){result=value}export function useQuery(value){options=value;return result}');
const query = await import(queryMock);
const { InventoryHistory } = await import(moduleUrl('../src/components/admin/inventory-history.tsx', {
  react: reactMock, 'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'),
  '@tanstack/react-query': queryMock, '@/entities/inventory/api/get-stock-adjustments': getUrl, '@/shared/api/client': apiUrl,
}));
let retries;
function render(overrides = {}, props = { productId: 670, memberId: 8 }) {
  retries = 0;
  query.setResult({ isPending: false, isFetching: false, isError: false, data: pageData(), refetch: () => { retries++; }, ...overrides });
  const tree = InventoryHistory(props);
  return { tree, html: renderToStaticMarkup(tree) };
}
function find(node, predicate) {
  if (!React.isValidElement(node)) return undefined;
  if (predicate(node)) return node;
  for (const child of [node.props.children].flat(Infinity)) { const found = find(child, predicate); if (found) return found; }
}
const button = (tree, text) => find(tree, node => node.type === 'button' && node.props.children === text);
test('history renders signed quantity, actor, before/after, time and multiline reason', () => {
  state.reset();
  const { html } = render();
  for (const text of ['감소 -2개', '재고 담당자', '회원 #8', '12개 → 10개', '파손 확인\n폐기 처리', '전체 11건', '1 / 2 페이지', '한국 시간']) assert.ok(html.includes(text), text);
  assert.match(html, /whitespace-pre-wrap/);
  assert.match(html, /overflow-wrap:anywhere/);
  assert.ok(render({ data: pageData([{ ...fixture, type: 'INCREASE', delta: 5 }]) }).html.includes('증가 +5개'));
});
test('pagination boundaries and refresh return to the first page', () => {
  state.reset();
  let { tree } = render();
  assert.equal(button(tree, '이전').props.disabled, true);
  button(tree, '다음').props.onClick();
  ({ tree } = render());
  assert.deepEqual(query.options.queryKey, ['inventory-history', 8, 670, 1, 10]);
  assert.equal(button(tree, '다음').props.disabled, true);
  button(tree, '이전').props.onClick();
  assert.equal(state.page, 0);
  state.reset(1);
  button(render().tree, '이력 새로고침').props.onClick();
  assert.equal(state.page, 0);
  button(render().tree, '이력 새로고침').props.onClick();
  assert.equal(retries, 1);
});
test('loading hides cached rows and empty pages have appropriate feedback', () => {
  state.reset();
  for (const value of [{ isPending: true, data: undefined }, { isFetching: true }]) {
    const { html } = render(value);
    assert.ok(html.includes('불러오는 중'));
    assert.ok(!html.includes('재고 담당자'));
  }
  assert.ok(render({ data: pageData([], { totalElements: 0, totalPages: 0 }) }).html.includes('아직 재고 변경 이력이 없습니다.'));
  assert.ok(render({ data: pageData([]) }).html.includes('첫 페이지에서 다시 확인'));
});
test('errors hide cached rows and allow retry', () => {
  for (const [status, text] of [[401, '로그인이 필요'], [403, '권한이 없습니다'], [404, '상품을 찾을 수 없습니다'], [500, '불러오지 못했습니다']]) {
    const { html, tree } = render({ isError: true, error: new ApiError('test', status) });
    assert.ok(html.includes(text));
    assert.ok(!html.includes('재고 담당자'));
    button(tree, '다시 시도').props.onClick();
    assert.equal(retries, 1);
  }
});
test('cache separates product, account and page and cancels unmounted requests', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  state.reset(); render();
  const options = query.options;
  const original = globalThis.fetch;
  let aborted = false;
  globalThis.fetch = (_path, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')); });
  });
  try {
    const observer = new QueryObserver(client, options);
    const unsubscribe = observer.subscribe(() => {});
    unsubscribe();
    assert.equal(aborted, true);
    client.setQueryData(options.queryKey, pageData());
    for (const props of [{ productId: 671, memberId: 8 }, { productId: 670, memberId: 9 }]) {
      render({}, props);
      assert.equal(client.getQueryData(query.options.queryKey), undefined);
    }
    state.reset(1); render();
    assert.equal(client.getQueryData(query.options.queryKey), undefined);
  } finally { globalThis.fetch = original; client.clear(); }
});

const selectionUrl = url(`export * from ${JSON.stringify(import.meta.resolve('react'))};export let selected=null;export let versions={};export function useRef(){return {current:null}}export function useState(initial){return initial===null?[selected,value=>{selected=value}]:[versions,value=>{versions=typeof value==="function"?value(versions):value}]}`);
await import(selectionUrl);
const parentQueryUrl = url('export function useQuery(options){return options.queryKey[0]==="me"?{data:{id:8,permissions:["MENU_ADMIN_ACCESS"]}}:{data:[]}}');
const { InventoryManagement } = await import(moduleUrl('../src/components/admin/inventory-management.tsx', {
  react: selectionUrl, 'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'),
  'next/link': url('export default function Link(){return null}'),
  '@tanstack/react-query': parentQueryUrl,
  '@/entities/session': url('export function canAccessAdmin(member){return member.permissions.includes("MENU_ADMIN_ACCESS")}export function hasPermission(member,code){return member?.permissions.includes(code)??false}'),
  '@/lib/api': url('export function currentMember(){}export function listProducts(){}'),
  './admin-navigation': url('export function AdminNavigation(){return null}'),
  './product-management-list': url('export function ProductManagementList(){return null}'),
  './inventory-detail': url('export function InventoryDetail(){return null}'),
  './inventory-history': url('export function InventoryHistory(){return null}'),
}));
test('selection keys the whole detail by product/account and closing removes it', () => {
  const original=globalThis.window;globalThis.window={matchMedia:()=>({matches:false})};
  const detailNode=tree=>find(tree,n=>n.type.name==='InventoryDetail');
  const listNode=tree=>find(tree,n=>n.type.name==='ProductManagementList');
  try {
    let tree=InventoryManagement();assert.equal(detailNode(tree),undefined);
    listNode(tree).props.onSelect({id:670});tree=InventoryManagement();
    assert.equal(detailNode(tree).key,'8:670');assert.equal(detailNode(tree).props.productId,670);
    listNode(tree).props.onSelect({id:671});tree=InventoryManagement();
    assert.equal(detailNode(tree).key,'8:671');
    detailNode(tree).props.onClose();assert.equal(detailNode(InventoryManagement()),undefined);
  } finally {globalThis.window=original}
});
test('saving refreshes only the submitted product history version', () => {
  const original=globalThis.window;globalThis.window={matchMedia:()=>({matches:false})};
  const detailNode=tree=>find(tree,n=>n.type.name==='InventoryDetail');
  const listNode=tree=>find(tree,n=>n.type.name==='ProductManagementList');
  try {
    listNode(InventoryManagement()).props.onSelect({id:670});let tree=InventoryManagement();
    assert.equal(detailNode(tree).props.canAdjust,false);assert.equal(detailNode(tree).props.memberId,8);
    detailNode(tree).props.onRefresh(670);tree=InventoryManagement();
    assert.equal(detailNode(tree).props.historyVersion,1);
    listNode(tree).props.onSelect({id:671});assert.equal(detailNode(InventoryManagement()).props.historyVersion,0);
  } finally {globalThis.window=original}
});

const tabStateUrl=url(`export * from ${JSON.stringify(import.meta.resolve('react'))};export let active='current';export function reset(){active='current'}export function useState(){return [active,value=>{active=value}]}`);
const tabState=await import(tabStateUrl);
const detailQueryUrl=url('export function useQuery(){return {data:{id:670,name:"상품",description:"설명",stockQuantity:10,categoryLabel:"보충제"}}}export function useQueryClient(){return {}}');
const {InventoryDetail}=await import(moduleUrl('../src/components/admin/inventory-detail.tsx',{
  react:tabStateUrl,'react/jsx-runtime':import.meta.resolve('react/jsx-runtime'),'@tanstack/react-query':detailQueryUrl,
  '@/entities/product/api/get-product':url('export function getProduct(){}'),
  '@/entities/product/ui/product-image-preview':url('export function ProductImagePreview(){return null}'),
  '@/shared/api/client':apiUrl,
  '@/features/adjust-stock/ui/stock-adjustment-form':url('export function StockAdjustmentForm(){return null}'),
  './inventory-history':url('export function InventoryHistory(){return null}'),
}));
function detail(overrides={}){return InventoryDetail({productId:670,memberId:8,canAdjust:true,historyVersion:0,onRefresh(){},onClose(){},...overrides})}
const tab=(tree,name)=>find(tree,n=>n.props.role==='tab'&&n.props.children===name);
const panel=(tree,name)=>find(tree,n=>n.props.role==='tabpanel'&&n.props.id.endsWith(name+'-panel'));
test('tabs share product header and hide panels without unmounting the input form',()=>{
  tabState.reset();let tree=detail();
  const formBefore=find(tree,n=>n.type.name==='StockAdjustmentForm');
  assert.equal(tab(tree,'재고 현황·조정').props['aria-selected'],true);
  assert.equal(panel(tree,'current').props.hidden,false);assert.equal(panel(tree,'history').props.hidden,true);
  tab(tree,'변경 이력').props.onClick();tree=detail();
  assert.equal(tab(tree,'변경 이력').props['aria-selected'],true);
  assert.equal(panel(tree,'current').props.hidden,true);assert.equal(panel(tree,'history').props.hidden,false);
  const formAfter=find(tree,n=>n.type.name==='StockAdjustmentForm');
  assert.equal(formAfter.type,formBefore.type);assert.equal(formAfter.key,formBefore.key);
  assert.ok(formAfter);assert.ok(find(tree,n=>n.type.name==='InventoryHistory'));
  tab(tree,'재고 현황·조정').props.onClick();assert.equal(panel(detail(),'current').props.hidden,false);
});
test('tab keyboard navigation moves selection and focus with arrows, Home and End',()=>{
  tabState.reset();let focused;let prevented=0;
  const event=key=>({key,preventDefault(){prevented++},currentTarget:{parentElement:{querySelector(selector){return {focus(){focused=selector}}}}}});
  tab(detail(),'재고 현황·조정').props.onKeyDown(event('ArrowRight'));
  assert.equal(tabState.active,'history');assert.equal(focused,'#inventory-8-670-history-tab');
  tab(detail(),'변경 이력').props.onKeyDown(event('Home'));assert.equal(tabState.active,'current');
  tab(detail(),'재고 현황·조정').props.onKeyDown(event('End'));assert.equal(tabState.active,'history');
  tab(detail(),'변경 이력').props.onKeyDown(event('ArrowLeft'));assert.equal(tabState.active,'current');
  tab(detail(),'재고 현황·조정').props.onKeyDown(event('Tab'));assert.equal(prevented,4);
});
test('history refresh keeps current tab/form and resets only history identity',()=>{
  tabState.reset();const before=detail();const after=detail({historyVersion:1});
  assert.equal(tabState.active,'current');
  assert.equal(find(before,n=>n.type.name==='StockAdjustmentForm').key,find(after,n=>n.type.name==='StockAdjustmentForm').key);
  assert.equal(find(before,n=>n.type.name==='InventoryHistory').key,'8:670');
  assert.equal(find(after,n=>n.type.name==='InventoryHistory').key,'8:670:1');
  button(after,'변경 이력 보기').props.onClick({currentTarget:{closest(){return null}}});
  assert.equal(tabState.active,'history');
});
