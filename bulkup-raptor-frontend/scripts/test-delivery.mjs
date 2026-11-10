import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
function moduleUrl(path, imports = {}) {
  let { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  for (const [name, target] of Object.entries(imports)) outputText = outputText.replaceAll(`"${name}"`, `"${target}"`);
  return url(outputText);
}
const common = { react: import.meta.resolve('react'), 'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'), '@tanstack/react-query': import.meta.resolve('@tanstack/react-query') };
const clientUrl = moduleUrl('../src/shared/api/client.ts');
const { ApiError } = await import(clientUrl);
const modelUrl = moduleUrl('../src/entities/delivery/model/delivery-types.ts', { zod: import.meta.resolve('zod') });
const models = await import(modelUrl);
const apiUrl = moduleUrl('../src/entities/delivery/api/deliveries.ts', { zod: import.meta.resolve('zod'), '@/shared/api/client': clientUrl, '../model/delivery-types': modelUrl });
const api = await import(apiUrl);
const info = { deliveryId: 7, orderId: 51, status: 'PREPARING', version: 0, recipientName: '배송 수령인', phone: '01012345678', postalCode: '12345', address: '수령 주소', addressDetail: '지정 장소', centerName: null, pickupLocation: null, scheduledAt: null, createdAt: '2026-11-08T09:00:00Z', startedAt: null, deliveredAt: null, items: [{ productName: '주문 간식', quantity: 2 }] };
const admin = { delivery: info, history: [] };
const summary = (({ phone, postalCode, address, addressDetail, centerName, pickupLocation, scheduledAt, ...rest }) => rest)(info);
const pageData = { content: [summary], page: 0, size: 10, totalPages: 1, totalElements: 1 };
const history = [{ id: 1, fromStatus: 'PREPARING', toStatus: 'OUT_FOR_DELIVERY', actorId: 4, reason: '내부 전달 메모', createdAt: '2026-11-08T09:30:00Z' }];
async function withFetch(fn) {
  const previous = globalThis.fetch;
  try { await fn(); } finally { globalThis.fetch = previous; }
}
test('list passes escaped filters, cookies and the AbortSignal', () => withFetch(async () => {
  let call; const signal = new AbortController().signal;
  globalThis.fetch = async (path, init) => { call = { path: new URL(path), init }; return new Response(JSON.stringify(pageData)); };
  assert.deepEqual(await api.getAdminDeliveries({ page: 2, size: 10, status: 'PREPARING', search: '김 & 이' }, signal), pageData);
  assert.equal(call.path.pathname, '/api/admin/deliveries');
  assert.equal(call.path.searchParams.get('search'), '김 & 이');
  assert.equal(call.path.searchParams.get('page'), '2');
  assert.equal(call.init.credentials, 'include');
  assert.equal(call.init.signal, signal);
}));
test('status change sends the read version, trims the note and validates the response', () => withFetch(async () => {
  let call;
  globalThis.fetch = async (path, init) => { call = { path: new URL(path), init }; return new Response(JSON.stringify({ delivery: { ...info, status: 'OUT_FOR_DELIVERY', version: 1 }, history })); };
  await api.changeDeliveryStatus(7, 'OUT_FOR_DELIVERY', 0, '  전달 메모  ');
  assert.equal(call.path.pathname, '/api/admin/deliveries/7/status');
  assert.equal(call.init.method, 'PATCH');
  assert.deepEqual(JSON.parse(call.init.body), { status: 'OUT_FOR_DELIVERY', expectedVersion: 0, reason: '전달 메모' });
  await api.changeDeliveryStatus(7, 'OUT_FOR_DELIVERY', 0, '  ');
  assert.equal(JSON.parse(call.init.body).reason, null);
}));
test('API rejects foreign IDs, unexpected states and malformed versions', () => withFetch(async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ delivery: { ...info, deliveryId: 8 }, history: [] }));
  await assert.rejects(api.getAdminDelivery(7), /번호가 일치/);
  globalThis.fetch = async () => new Response(JSON.stringify({ delivery: { ...info, orderId: 52 }, history: [] }));
  await assert.rejects(api.getOrderDelivery(51), /번호가 일치/);
  globalThis.fetch = async () => new Response(JSON.stringify(admin));
  await assert.rejects(api.changeDeliveryStatus(7, 'DELIVERED', 0, ''), /변경 결과/);
  for (const value of [-1, NaN, 1.5]) await assert.rejects(api.changeDeliveryStatus(7, 'DELIVERED', value, ''), /변경 정보/);
  await assert.rejects(api.getAdminDelivery(0), /번호가 필요/);
  globalThis.fetch = async () => new Response(JSON.stringify({ delivery: { ...info, status: 'UNKNOWN' }, history: [] }));
  await assert.rejects(api.getOrderDelivery(51), /응답을 읽지/);
}));
test('customer response strips actor IDs and private notes even if the server sends them', () => withFetch(async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ delivery: info, history }));
  const result = await api.getOrderDelivery(51);
  assert.deepEqual(Object.keys(result.history[0]).sort(), ['createdAt', 'fromStatus', 'toStatus']);
}));
test('HTTP errors preserve authentication, missing data and conflict codes', () => withFetch(async () => {
  for (const status of [401, 403, 404, 409, 500]) {
    globalThis.fetch = async () => new Response(JSON.stringify({ code: 'TEST_CODE', detail: 'server message' }), { status });
    await assert.rejects(api.getAdminDelivery(7), e => e instanceof ApiError && e.status === status && e.code === 'TEST_CODE');
  }
}));
test('query keys separate accounts, customer orders, admin detail and filters', () => {
  const keys = models.deliveryKeys; const filters = { page: 0, size: 10, status: 'PREPARING', search: '' };
  assert.notDeepEqual(keys.order(4, 51), keys.order(5, 51));
  assert.notDeepEqual(keys.detail(4, 7), keys.order(4, 7));
  assert.notDeepEqual(keys.list(4, filters), keys.list(4, { ...filters, search: '김' }));
  assert.notDeepEqual(keys.list(4, filters), keys.list(4, { ...filters, page: 1 }));
});
const sessionUrl = moduleUrl('../src/entities/session/model/admin-access.ts');
const libUrl = url('export async function currentMember(){return null}');
const detailsUrl = moduleUrl('../src/entities/delivery/ui/delivery-details.tsx', { ...common, '@/shared/api/client': clientUrl, '../model/delivery-types': modelUrl });
const { DeliveryDetails, DeliveryError } = await import(detailsUrl);
test('details display creation time separately from status changes and hide internal history from customers', () => {
  const props = { delivery: info, history };
  const publicHtml = renderToStaticMarkup(React.createElement(DeliveryDetails, props));
  assert.ok(publicHtml.includes('배송 준비 중 → 배송 중'));
  assert.ok(publicHtml.includes('수령지'));
  assert.ok(publicHtml.includes('(12345) 수령 주소 지정 장소'));
  for (const unused of ['수령 예정', '수령 장소', '>캠프<', '미정']) assert.ok(!publicHtml.includes(unused), unused);
  assert.ok(publicHtml.includes('한국 시간'));
  assert.ok(!publicHtml.includes('내부 전달 메모'));
  assert.ok(!publicHtml.includes('처리자 #4'));
  const internalHtml = renderToStaticMarkup(React.createElement(DeliveryDetails, { ...props, internal: true }));
  assert.ok(internalHtml.includes('내부 전달 메모'));
  assert.ok(internalHtml.includes('처리자 #4'));
  assert.ok(renderToStaticMarkup(React.createElement(DeliveryDetails, { delivery: info, history: [] })).includes('아직 배송 상태 변경 내역이 없습니다.'));
});
test('loading errors distinguish missing data and permissions without showing cached private data', () => {
  for (const [status, expected] of [[401, '로그인이 필요'], [403, '권한이 없습니다'], [404, '아직 준비되지'], [500, '불러오지 못했습니다']]) {
    const html = renderToStaticMarkup(React.createElement(DeliveryError, { error: new ApiError('test', status), onRetry() {} }));
    assert.ok(html.includes(expected)); assert.ok(!html.includes('수령 주소'));
  }
});
const hooksUrl = moduleUrl('../src/entities/delivery/model/use-deliveries.ts', { ...common, '@/entities/session': sessionUrl, '@/shared/api/client': clientUrl, '../api/deliveries': apiUrl, './delivery-types': modelUrl });
const hooks = await import(hooksUrl);
test('customer query stays disabled until opened, and invalid account/IDs cannot fetch', () => {
  function inspect(memberId, orderId, open) {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    function Probe() { hooks.useOrderDelivery(memberId, orderId, open); return null; }
    renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(Probe)));
    return client.getQueryCache().getAll()[0].options;
  }
  assert.equal(inspect(4, 51, false).enabled, false);
  assert.equal(inspect(null, 51, true).enabled, false);
  assert.equal(inspect(4, NaN, true).enabled, false);
  assert.equal(inspect(4, 51, true).enabled, true);
  assert.equal(inspect(4, 51, true).refetchOnWindowFocus, true);
});
// Exercise the mutation's application callbacks with a small hook adapter; QueryClient remains real.
const reactStub = url('export function useRef(value){return {current:value}}');
const mutationStub = url(`
export let config;export let apiCalls=0;export let send=async()=>({});export let client;
export function setup(c,fn){client=c;send=fn;apiCalls=0}
export function useQueryClient(){return client}export function useIsMutating(){return 0}
export function useMutation(value){config=value;return {reset(){},isPending:false,error:null,isSuccess:false,
 async mutateAsync(input){try{apiCalls++;const result=await value.mutationFn(input);await value.onSuccess(result);return result}catch(e){await value.onError(e);throw e}}}}
export function changeDeliveryStatus(...args){return send(...args)}
`);
const mutationState = await import(mutationStub);
const commandUrl = moduleUrl('../src/features/change-delivery-status/model/use-change-delivery-status.ts', {
  react: reactStub, '@tanstack/react-query': mutationStub, '@/entities/session': sessionUrl, '@/shared/api/client': clientUrl,
  '@/entities/delivery/api/deliveries': mutationStub, '@/entities/delivery/model/delivery-types': modelUrl,
});
const { useChangeDeliveryStatus } = await import(commandUrl);
const member = { id: 4, roles: [{ code: 'MEMBER' }], permissions: ['MENU_ADMIN_ACCESS', 'SHIPPING_MANAGE'] };
function commandClient() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  client.setQueryData(['me'], member);
  const events = [];
  client.cancelQueries = async value => { events.push(['cancel', value.queryKey]); };
  client.invalidateQueries = async value => { events.push(['invalidate', value.queryKey]); };
  return { client, events };
}
test('mutation prevents double submission, cancels stale reads and applies the confirmed response', async () => {
  const { client, events } = commandClient(); let finish; let calls = 0;
  mutationState.setup(client, () => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const hook = useChangeDeliveryStatus(4, 7);
  const first = hook.submit({ status: 'OUT_FOR_DELIVERY', expectedVersion: 0, reason: '' });
  await hook.submit({ status: 'OUT_FOR_DELIVERY', expectedVersion: 0, reason: '' });
  assert.equal(calls, 1);
  const result = { delivery: { ...info, status: 'OUT_FOR_DELIVERY', version: 1 }, history };
  finish(result); await first;
  assert.deepEqual(client.getQueryData(models.deliveryKeys.detail(4, 7)), result);
  assert.deepEqual(events.map(e => e[0]), ['cancel', 'invalidate']);
  assert.equal(mutationState.config.retry, false);
});
test('conflicts refresh data once and never retry the write automatically', async () => {
  const { client, events } = commandClient(); let calls = 0;
  mutationState.setup(client, async () => { calls++; throw new ApiError('stale', 409); });
  await useChangeDeliveryStatus(4, 7).submit({ status: 'DELIVERED', expectedVersion: 0, reason: '' });
  assert.equal(calls, 1);
  assert.deepEqual(events, [['invalidate', models.deliveryKeys.member(4)]]);
});
test('account changes during a write cannot populate the new account cache', async () => {
  const { client, events } = commandClient(); let finish;
  mutationState.setup(client, () => new Promise(resolve => { finish = resolve; }));
  const task = useChangeDeliveryStatus(4, 7).submit({ status: 'OUT_FOR_DELIVERY', expectedVersion: 0, reason: '' });
  client.setQueryData(['me'], { ...member, id: 5 }); finish(admin); await task;
  assert.equal(client.getQueryData(models.deliveryKeys.detail(4, 7)), undefined);
  assert.equal(client.getQueryData(models.deliveryKeys.detail(5, 7)), undefined);
  assert.deepEqual(events, []);
});
test('missing write permission prevents API calls and a 401 removes delivery caches', async () => {
  const { client } = commandClient(); let calls = 0;
  mutationState.setup(client, async () => { calls++; throw new ApiError('login', 401); });
  client.setQueryData(['me'], { ...member, permissions: ['MENU_ADMIN_ACCESS'] });
  await useChangeDeliveryStatus(4, 7).submit({ status: 'OUT_FOR_DELIVERY', expectedVersion: 0, reason: '' });
  assert.equal(calls, 0);
  client.setQueryData(['me'], member); client.setQueryData(models.deliveryKeys.detail(4, 7), admin);
  await useChangeDeliveryStatus(4, 7).submit({ status: 'OUT_FOR_DELIVERY', expectedVersion: 0, reason: '' });
  assert.equal(client.getQueryData(['me']), null);
  assert.equal(client.getQueryData(models.deliveryKeys.detail(4, 7)), undefined);
});
const dialogUrl = moduleUrl('../src/shared/ui/dialog.tsx', common);
const changeHookUrl = moduleUrl('../src/features/change-delivery-status/model/use-change-delivery-status.ts', {
  ...common, '@/entities/session': sessionUrl, '@/shared/api/client': clientUrl, '@/entities/delivery/api/deliveries': apiUrl, '@/entities/delivery/model/delivery-types': modelUrl,
});
const changeUiUrl = moduleUrl('../src/features/change-delivery-status/ui/change-delivery-status.tsx', { ...common, '@/shared/api/client': clientUrl, '../model/use-change-delivery-status': changeHookUrl });
const adminDetailUrl = moduleUrl('../src/components/admin/admin-delivery-detail.tsx', {
  ...common, '@/lib/api': libUrl, '@/entities/session': sessionUrl, '@/shared/ui/dialog': dialogUrl,
  '@/entities/delivery/model/use-deliveries': hooksUrl, '@/entities/delivery/ui/delivery-details': detailsUrl,
  '@/features/change-delivery-status/ui/change-delivery-status': changeUiUrl,
});
const { AdminDeliveryDetail } = await import(adminDetailUrl);
function renderDetail(viewer, data) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, staleTime: Infinity } } });
  client.setQueryData(['me'], viewer); client.setQueryData(models.deliveryKeys.detail(4, 7), data);
  return renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(AdminDeliveryDetail, { memberId: 4, deliveryId: 7, onClose() {} })));
}
test('read-only admins see detail but no write form; shipping operators see the next valid action', () => {
  assert.ok(renderDetail({ ...member, permissions: ['MENU_ADMIN_ACCESS'] }, admin).includes('조회만 가능합니다'));
  assert.ok(!renderDetail({ ...member, permissions: ['MENU_ADMIN_ACCESS'] }, admin).includes('배송 시작</button>'));
  assert.ok(renderDetail(member, admin).includes('배송 시작</button>'));
  assert.ok(renderDetail(member, { delivery: { ...info, status: 'OUT_FOR_DELIVERY', version: 1 }, history }).includes('전달 완료 처리</button>'));
  const delivered = renderDetail(member, { delivery: { ...info, status: 'DELIVERED', version: 2 }, history });
  assert.ok(delivered.includes('직원에게 전달이 완료'));
  assert.ok(!delivered.includes('전달 메모 · 선택'));
});
test('detail from a previous account is never rendered after account change', () => {
  const html = renderDetail({ ...member, id: 5 }, admin);
  assert.ok(!html.includes('수령 주소')); assert.ok(!html.includes('배송 수령인'));
});
const linkUrl = url(`import React from ${JSON.stringify(import.meta.resolve('react'))};export default function Link({children,...props}){return React.createElement('a',props,children)}`);
const { OrderHistory } = await import(moduleUrl('../src/entities/order/ui/order-history.tsx', { ...common, 'next/link': linkUrl }));
test('paid order cards expose a separate delivery slot without nesting a button inside a link', () => {
  const orders = ['PAID', 'CREATED', 'CANCELLED'].map((status, index) => ({ orderId: index + 1, status, createdAt: info.createdAt, totalAmount: 1000, items: info.items }));
  const html = renderToStaticMarkup(React.createElement(OrderHistory, { orders, renderDelivery: order => React.createElement('button', { type: 'button' }, `배송 조회 ${order.orderId}`) }));
  assert.ok(html.includes('배송 조회 1')); assert.ok(!html.includes('배송 조회 2')); assert.ok(!html.includes('배송 조회 3'));
  assert.ok(html.indexOf('</a>') < html.indexOf('배송 조회 1'));
});

test('delivery shows latest handler name and keeps per-change names internal', () => {
  const props = { delivery: { ...info, handlerName: '현재담당자' }, history: [{ ...history[0], actorName: '이전처리자' }] };
  const publicHtml = renderToStaticMarkup(React.createElement(DeliveryDetails, props));
  assert.ok(publicHtml.includes('현재담당자'));
  assert.ok(!publicHtml.includes('이전처리자'));
  const internalHtml = renderToStaticMarkup(React.createElement(DeliveryDetails, { ...props, internal: true }));
  assert.ok(internalHtml.includes('처리자 이전처리자'));
  assert.ok(renderToStaticMarkup(React.createElement(DeliveryDetails, { delivery: info, history: [] })).includes('미배정'));
});
