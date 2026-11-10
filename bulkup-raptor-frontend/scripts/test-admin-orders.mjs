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
const apiUrl = url('export const calls=[];export class ApiError extends Error{constructor(message,status){super(message);this.status=status}};export async function apiFetch(path,init){calls.push({path,...init})}');
const api = await import(apiUrl);
const ordersUrl = moduleUrl('../src/entities/order/api/get-admin-orders.ts', { '@/shared/api/client': apiUrl });
const { getAdminOrders, getAdminOrder } = await import(ordersUrl);
test('admin order API sends pagination, optional status, encoded search and abort signal', async () => {
  const signal = new AbortController().signal;
  await getAdminOrders({ page: 0, size: 10, search: '', status: 'ALL' }, signal);
  assert.equal(api.calls.at(-1).path, '/api/admin/orders?page=0&size=10&search=');
  assert.equal(api.calls.at(-1).signal, signal);
  await getAdminOrders({ page: 2, size: 50, search: '구매자_%&', status: 'CREATED' });
  const query = new URL(api.calls.at(-1).path, 'http://localhost').searchParams;
  assert.equal(query.get('search'), '구매자_%&');
  assert.equal(query.get('status'), 'CREATED');
  assert.equal(query.get('page'), '2');
  await getAdminOrder(153, signal);
  assert.equal(api.calls.at(-1).path, '/api/admin/orders/153');
  assert.equal(api.calls.at(-1).signal, signal);
});
const common = { react: import.meta.resolve('react'), 'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'), '@tanstack/react-query': import.meta.resolve('@tanstack/react-query') };
const imports = {
  ...common,
  'next/link': url(`import React from ${JSON.stringify(import.meta.resolve('react'))};export default function Link(p){return React.createElement('a',p)}`),
  '@/lib/api': url('export async function currentMember(){return null}'),
  '@/entities/session': moduleUrl('../src/entities/session/model/admin-access.ts'),
  '@/entities/delivery/model/delivery-types': url('export const deliveryLabels={PREPARING:"배송 준비 중",OUT_FOR_DELIVERY:"배송 중",DELIVERED:"전달 완료"}'),
  '@/features/cancel-order': url(`import React from ${JSON.stringify(import.meta.resolve('react'))};export function CancelOrderButton({order}){return order.status==="PAID"&&order.deliveryStatus==="PREPARING"?React.createElement("button",null,"주문 취소"):null}`),
  '@/features/cancel-order/api/cancel-order': url('export async function cancelOrders(){return {results:[]}}'),
  '@/features/cancel-order/ui/bulk-cancel-dialog': url('export const BulkCancelDialog=()=>null;export const BulkCancelResultDialog=()=>null'),
  '@/entities/order/api/get-admin-orders': ordersUrl,
  '@/entities/order/ui/order-status-tabs': moduleUrl('../src/entities/order/ui/order-status-tabs.tsx',common),
  '@/entities/order/ui/order-details': moduleUrl('../src/entities/order/ui/order-details.tsx', common),
  '@/components/admin/admin-cancellation-dialog': url('export const AdminCancellationDialog=()=>null'),
  '@/components/admin/admin-navigation': url('export const AdminNavigation=()=>null'),
  '@/components/ui/badge': moduleUrl('../src/components/ui/badge.tsx', common),
  '@/components/ui/select': url('export const Select=()=>null'),
  '@/components/ui/search-filter-bar': moduleUrl('../src/components/ui/search-filter-bar.tsx', common),
  '@/shared/api/client': apiUrl,
};
const { OrderManagement } = await import(moduleUrl('../src/components/admin/order-management.tsx', imports));
const { AdminOrderDetail } = await import(moduleUrl('../src/components/admin/admin-order-detail.tsx', imports));
const viewer = { id: 1, roles: [{ code: 'MEMBER' }], permissions: ['MENU_ADMIN_ACCESS'] };
const manager = { ...viewer, permissions: ['MENU_ADMIN_ACCESS', 'ORDER_MANAGE'] };
const buyer = { memberId: 45, name: '주문자 테스트', email: 'buyer@example.test' };
const row = { orderId: 153, buyer, totalAmount: 5400, status: 'CREATED', items: [{ productName: '주문 당시 상품', quantity: 2 }, { productName: '두 번째 상품', quantity: 1 }], createdAt: '2026-11-01T01:00:00Z' };
const detailData = {
  buyer,
  order: { ...row, items: [{ productId: 1, productName: '주문 당시 상품', unitPrice: 1200, quantity: 2, lineTotal: 2400 }], itemsTotal: 2400, shippingFee: 3000, delivery: { recipientName: '수령인', phone: '01012345678', postalCode: '06236', address: '서울 배송지', addressDetail: '101호' } },
  payment: null,
};
const payment = { orderId: 153, paymentId: 'payment-order-test', totalAmount: 5400, currency: 'KRW', paymentMethod: 'KAKAOPAY', status: 'PAID', createdAt: '2026-11-01T01:00:00Z', paidAt: '2026-11-01T01:01:00Z', webhookVerifiedAt: null };
function render(Component, member, key, data, props = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, staleTime: Infinity, retry: false } } });
  client.setQueryData(['me'], member);
  if (data !== undefined) client.setQueryData(key, data);
  const html = renderToString(React.createElement(QueryClientProvider, { client }, React.createElement(Component, props))).replaceAll('<!-- -->', '');
  return { html, client };
}
const listKey = ['admin-orders', 1, 0, 10, { search: '', status: 'ALL' }];
const detailKey = ['admin-order', 1, 153];
const page = content => ({ content, page: 0, size: 10, totalPages: 2, totalElements: 11 });
test('whole order list includes unpaid and paid orders with buyer, snapshot, quantity and detail link', () => {
  const { html } = render(OrderManagement, viewer, listKey, page([row, { ...row, orderId: 154, status: 'PAID' }]));
  for (const value of ['주문자 테스트', 'buyer@example.test', '주문 당시 상품', '외 1종', '총 3개', '5,400원', '결제 대기', '결제 완료', 'href="/admin/orders/153"', '검색 결과 11건', '1 / 2 페이지']) assert.ok(html.includes(value), value);
});
test('order list has a distinct search empty state', () => {
  assert.ok(render(OrderManagement, viewer, listKey, page([])).html.includes('조건에 일치하는 주문이 없습니다.'));
});
test('anonymous and non-menu admin cannot render cached order or delivery data', () => {
  for (const member of [null, { id: 2, roles: [{ code: 'ADMIN' }], permissions: [] }]) {
    const list = render(OrderManagement, member, listKey, page([row])).html;
    const detail = render(AdminOrderDetail, member, detailKey, detailData, { orderId: 153 }).html;
    for (const html of [list, detail]) {
      assert.ok(html.includes('관리 권한이 필요해요'));
      assert.ok(!html.includes('주문자 테스트'));
      assert.ok(!html.includes('서울 배송지'));
    }
  }
});
test('detail without payment displays saved delivery and amounts and does not offer customer checkout', () => {
  const { html } = render(AdminOrderDetail, viewer, detailKey, detailData, { orderId: 153 });
  for (const value of ['주문자 테스트', '서울 배송지', '수령인', '01012345678', '주문 당시 상품', '5,400원', '아직 결제가 준비되지 않은 주문입니다.', 'href="/admin/orders"']) assert.ok(html.includes(value), value);
  assert.ok(!html.includes('결제 관리에서 보기'));
  assert.ok(!html.includes('결제하기'));
});
test('paid order detail links to the exact payment and preserves unverified webhook state', () => {
  const data = { ...detailData, order: { ...detailData.order, status: 'PAID' }, payment };
  const { html } = render(AdminOrderDetail, viewer, detailKey, data, { orderId: 153 });
  for (const value of ['결제 완료', 'payment-order-test', 'KAKAOPAY', '미확인', 'href="/admin/payments?search=payment-order-test"']) assert.ok(html.includes(value), value);
});
test('ready payment remains unconfirmed in order detail', () => {
  const data = { ...detailData, payment: { ...payment, status: 'READY', paymentMethod: null, paidAt: null } };
  const { html } = render(AdminOrderDetail, viewer, detailKey, data, { orderId: 153 });
  for (const value of ['결제 준비', '미확정', '—']) assert.ok(html.includes(value), value);
  assert.ok(!html.includes('>결제 완료<'));
});
test('invalid detail IDs show not-found feedback and disable the query', () => {
  for (const orderId of [0, -1, 1.5, NaN]) {
    const { html, client } = render(AdminOrderDetail, viewer, ['unused'], undefined, { orderId });
    assert.ok(html.includes('주문을 찾을 수 없습니다.'));
    const query = client.getQueryCache().find({ queryKey: ['admin-order', 1, orderId] });
    assert.equal(query.state.fetchStatus, 'idle');
  }
});
test('another admin account cannot see a previous account cached order detail while loading', () => {
  const { html } = render(AdminOrderDetail, { ...viewer, id: 2 }, detailKey, detailData, { orderId: 153 });
  assert.ok(html.includes('주문 정보를 불러오는 중입니다.'));
  assert.ok(!html.includes('서울 배송지'));
});


test('list shows delivery status and cancel only for preparing paid orders',()=>{
  const preparing = render(OrderManagement, manager, listKey, page([{...row, status:'PAID', deliveryStatus:'PREPARING'}])).html;
  for (const value of ['주문·배송', '배송 준비 중', '>주문 취소</button>']) assert.ok(preparing.includes(value), value);
  const shipped = render(OrderManagement, manager, listKey, page([{...row, status:'PAID', deliveryStatus:'OUT_FOR_DELIVERY'}])).html;
  assert.ok(shipped.includes('배송 중'));
  assert.ok(!shipped.includes('>주문 취소</button>'));
  const unpaid = render(OrderManagement, manager, listKey, page([row])).html;
  assert.ok(unpaid.includes('배송 없음'));
  assert.ok(!unpaid.includes('>주문 취소</button>'));
  const viewerList = render(OrderManagement, viewer, listKey, page([{...row, status:'PAID', deliveryStatus:'PREPARING'}])).html;
  assert.ok(viewerList.includes('권한 없음'));
  assert.ok(!viewerList.includes('>주문 취소</button>'));
  assert.ok(preparing.includes('href="/admin/orders/153"'));
  assert.ok(checkbox(preparing, 153) && !checkbox(preparing, 153).includes('disabled'));
  assert.ok(checkbox(shipped, 153).includes('disabled'));
  assert.ok(checkbox(unpaid, 153).includes('disabled'));
  assert.ok(checkbox(viewerList, 153).includes('disabled'));
  assert.ok(preparing.includes('aria-label="현재 페이지에서 취소 가능한 주문 선택"'));
  assert.ok(!preparing.includes('>선택 취소</button>'));
});

function checkbox(html, id) {
  return html.match(new RegExp(`<input[^>]*aria-label="주문 ${id} 선택"[^>]*>`))?.[0] ?? '';
}

test('order detail shows delivery status and cancel for managers',()=>{
  const data = { ...detailData, order: { ...detailData.order, status: 'PAID', deliveryStatus: 'PREPARING' }, payment };
  const { html } = render(AdminOrderDetail, manager, detailKey, data, { orderId: 153 });
  assert.ok(html.includes('배송 준비 중'));
  assert.ok(html.includes('주문 취소'));
});

test('cancelled orders show a stored reason and hide the delivery badge',()=>{
 const withReason = render(OrderManagement, viewer, listKey, page([{...row, status:'CANCELLED', deliveryStatus:'PREPARING', cancellationReason:'재고 부족'}])).html;
 assert.ok(withReason.includes('주문 취소됨'));
 assert.ok(withReason.includes('취소 사유 재고 부족'));
 assert.ok(!withReason.includes('>배송 준비 중</span>'));
 const pending = render(OrderManagement, viewer, listKey, page([{...row, status:'PAID', cancellationPending:true, deliveryStatus:'PREPARING', cancellationReason:'재고 확인'}])).html;
 assert.ok(pending.includes('취소 사유 재고 확인'));
 assert.ok(!pending.includes('>배송 준비 중</span>'));
 const missing = render(OrderManagement, viewer, listKey, page([{...row, status:'CANCELLED', cancellationPending:true, deliveryStatus:'PREPARING'}])).html;
 assert.ok(!missing.includes('취소 사유'));
 assert.ok(!missing.includes('입력하지 않음'));
 assert.ok(!missing.includes('>배송 준비 중</span>'));
 const paid = render(OrderManagement, manager, listKey, page([{...row, status:'PAID', deliveryStatus:'PREPARING'}])).html;
 assert.ok(paid.includes('>배송 준비 중</span>'));
 assert.ok(paid.includes('>주문 취소</button>'));
 assert.ok(!paid.includes('취소 사유'));
});

test('cancelled orders have an explicit cancelled badge and a cancelled status tab',()=>{
 const {html}=render(OrderManagement,viewer,listKey,page([{...row,status:'CANCELLED',deliveryStatus:'PREPARING'}]));
 assert.ok(html.includes('주문 취소됨'));
 assert.ok(!html.includes('입력하지 않음'));
 assert.ok(!html.includes('>배송 준비 중</span>'));
 assert.ok(!html.includes('주문 생성 · 결제 전'));
 assert.ok(html.includes('role="tablist"'));
 assert.ok(!html.includes('주문 상태 필터'));
});

test('bulk cancel dialog shows the count and reason without cancelling until confirmed',()=>{
  const dialogUrl = moduleUrl('../src/features/cancel-order/ui/bulk-cancel-dialog.tsx', {
    ...common,
    '@/shared/ui/confirm-dialog': moduleUrl('../src/shared/ui/confirm-dialog.tsx', { ...common, './dialog': moduleUrl('../src/shared/ui/dialog.tsx', common) }),
    '@/shared/ui/dialog': moduleUrl('../src/shared/ui/dialog.tsx', common),
  });
  return import(dialogUrl).then(({ BulkCancelDialog, BulkCancelSummary }) => {
    const open = renderToString(React.createElement(BulkCancelDialog, { isOpen: true, count: 2, reason: '', pending: false, onReason() {}, onClose() {}, onConfirm() {} })).replaceAll('<!-- -->', '');
    assert.ok(open.includes('선택한 2건을 취소할까요?'));
    assert.ok(open.includes('취소 사유'));
    assert.ok(open.includes('>돌아가기</button>'));
    assert.ok(open.includes('>선택 취소</button>'));
    const closed = renderToString(React.createElement(BulkCancelDialog, { isOpen: false, count: 2, reason: '', pending: false, onReason() {}, onClose() {}, onConfirm() {} }));
    assert.equal(closed, '');
    const summary = renderToString(React.createElement(BulkCancelSummary, { result: { results: [
      { orderId: 51, succeeded: true }, { orderId: 52, succeeded: false, message: '배송 중인 주문은 직접 취소할 수 없습니다.' },
    ] } })).replaceAll('<!-- -->', '');
    assert.ok(summary.includes('1건을 취소했습니다.'));
    assert.ok(summary.includes('주문 #52 배송 중인 주문은 직접 취소할 수 없습니다.'));
  });
});

test('admin counts preserve active search and use all three status totals across pages',async()=>{
 const source=url(`export const calls=[];export async function apiFetch(path,init){calls.push({path,signal:init.signal});return {totalElements:{CREATED:4,PAID:25,CANCELLED:3}[new URL(path,'http://localhost').searchParams.get('status')],content:[]};}`);
 const api=await import(source);
 const {getAdminOrderCounts}=await import(moduleUrl('../src/entities/order/api/get-admin-orders.ts',{'@/shared/api/client':source}));
 const signal=new AbortController().signal;
 assert.deepEqual(await getAdminOrderCounts('검색어 &',signal),{CREATED:4,PAID:25,CANCELLED:3,ALL:32});
 for(const request of api.calls){const p=new URL(request.path,'http://localhost').searchParams;assert.equal(p.get('search'),'검색어 &');assert.equal(p.get('size'),'1');assert.equal(request.signal,signal);}
});
