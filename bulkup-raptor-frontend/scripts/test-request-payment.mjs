import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToString, renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
function moduleUrl(path, imports = {}) {
  let { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  for (const [name, url] of Object.entries(imports)) outputText = outputText.replaceAll(`"${name}"`, `"${url}"`);
  return dataUrl(outputText);
}
const base = '../src/features/prepare-payment/';
const resultUrl = moduleUrl(`${base}model/payment-result.ts`);
const { readPaymentResult, readPaymentRedirect, paymentResultMessage, verifiedPaymentResult } = await import(resultUrl);
const sdkUrl = dataUrl(`export let handler; export const setHandler = x => handler = x;
export const requestPayment = x => handler(x); export const isPaymentError = x => x?.__portOneErrorType === 'PaymentError';`);
const sdk = await import(sdkUrl);
const { requestPayment } = await import(moduleUrl(`${base}api/request-payment.ts`, {
  '@portone/browser-sdk/v2': sdkUrl, '../model/payment-result': resultUrl,
}));
const prepared = { paymentId: 'payment-51-test', orderName: '서버 주문명', totalAmount: 117800, currency: 'KRW' };
const member = { id: 7 };
const clientUrl = moduleUrl('../src/shared/api/client.ts');
const typesUrl = moduleUrl(`${base}model/payment-types.ts`, { zod: import.meta.resolve('zod') });
const apiUrl = moduleUrl(`${base}api/prepare-payment.ts`, { '@/shared/api/client': clientUrl, '../model/payment-types': typesUrl });
const verificationUrl = moduleUrl(`${base}api/verify-payment.ts`, { zod: import.meta.resolve('zod'), '@/shared/api/client': clientUrl });
const { verifyPayment } = await import(verificationUrl);
const ready = { ...prepared, orderId: 51, paymentStatus: 'READY', orderStatus: 'CREATED', providerStatus: 'READY', paidAt: null, transactionId: null, pgTxId: null, paymentMethod: null, canOpenPaymentWindow: true };
const paid = { ...ready, paymentStatus: 'PAID', orderStatus: 'PAID', providerStatus: 'PAID', paidAt: '2026-11-01T04:00:00Z', transactionId: 'tx-verified', pgTxId: 'pg-verified', paymentMethod: 'KAKAOPAY', canOpenPaymentWindow: false };
const prepareUrl = moduleUrl(`${base}model/use-prepare-payment.ts`, {
  react: import.meta.resolve('react'), '@tanstack/react-query': import.meta.resolve('@tanstack/react-query'),
  '@/shared/api/client': clientUrl, '../api/prepare-payment': apiUrl,
});
const { useRequestPayment } = await import(moduleUrl(`${base}model/use-request-payment.ts`, {
  react: import.meta.resolve('react'), '@tanstack/react-query': import.meta.resolve('@tanstack/react-query'),
  '../api/request-payment': moduleUrl(`${base}api/request-payment.ts`, { '@portone/browser-sdk/v2': sdkUrl, '../model/payment-result': resultUrl }),
  '@/features/cancel-order/api/cancel-order': moduleUrl('../src/features/cancel-order/api/cancel-order.ts', {zod:import.meta.resolve('zod'),'@/shared/api/client':clientUrl}),
  './use-prepare-payment': prepareUrl, '../api/verify-payment': verificationUrl, './payment-result': resultUrl, '@/shared/api/client': clientUrl,
}));
function setup(t) {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const oldStore = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
  const oldChannel = process.env.NEXT_PUBLIC_PORTONE_KAKAOPAY_CHANNEL_KEY;
  process.env.NEXT_PUBLIC_PORTONE_STORE_ID = 'store-test';
  process.env.NEXT_PUBLIC_PORTONE_KAKAOPAY_CHANNEL_KEY = 'channel-key-test';
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { origin: 'http://localhost:3000' } } });
  t.after(() => {
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else delete globalThis.window;
    if (oldStore === undefined) delete process.env.NEXT_PUBLIC_PORTONE_STORE_ID; else process.env.NEXT_PUBLIC_PORTONE_STORE_ID = oldStore;
    if (oldChannel === undefined) delete process.env.NEXT_PUBLIC_PORTONE_KAKAOPAY_CHANNEL_KEY; else process.env.NEXT_PUBLIC_PORTONE_KAKAOPAY_CHANNEL_KEY = oldChannel;
  });
}
function client() {
  const c = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  c.setQueryData(['me'], member);
  c.setQueryData(['orders', 7, 51], { orderId: 51, status: 'CREATED' });
  return c;
}
function hook(c) {
  let value;
  function Probe() { value = useRequestPayment(7, 51); return null; }
  renderToString(React.createElement(QueryClientProvider, { client: c }, React.createElement(Probe)));
  return value;
}
function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

test('SDK receives server payment values, test channel, window modes and return URL', async t => {
  setup(t);
  sdk.setHandler(async input => {
    assert.deepEqual(input, { ...prepared, storeId: 'store-test', channelKey: 'channel-key-test', payMethod: 'EASY_PAY',
      windowType: { pc: 'IFRAME', mobile: 'REDIRECTION' }, redirectUrl: 'http://localhost:3000/payments/result' });
    return { paymentId: prepared.paymentId };
  });
  assert.deepEqual(await requestPayment(prepared), { status: 'received', paymentId: prepared.paymentId, response: { paymentId: prepared.paymentId } });
});

test('missing public settings do not invoke SDK', async t => {
  setup(t);
  delete process.env.NEXT_PUBLIC_PORTONE_KAKAOPAY_CHANNEL_KEY;
  sdk.setHandler(() => { throw new Error('must not call'); });
  await assert.rejects(requestPayment(prepared), /결제창 설정이 없습니다/);
});

test('SDK cancellation, provider failure and thrown SDK cancellation are separated', async t => {
  setup(t);
  sdk.setHandler(async () => ({ code: 'FAILURE_TYPE_PG', message: '사용자가 결제를 취소했습니다.' }));
  assert.equal((await requestPayment(prepared)).status, 'cancelled');
  sdk.setHandler(async () => ({ code: 'FAILURE_TYPE_PG', message: '사용자가 프로세스를 중단하였습니다.', pgCode: 'CANCEL' }));
  assert.equal((await requestPayment(prepared)).status, 'cancelled');
  sdk.setHandler(async () => ({ code: 'PGProviderError', message: '카드 오류' }));
  assert.equal((await requestPayment(prepared)).status, 'failed');
  sdk.setHandler(async () => { throw { __portOneErrorType: 'PaymentError', code: 'Cancelled' }; });
  assert.equal((await requestPayment(prepared)).status, 'cancelled');
});

test('script load errors are distinct from provider failures', async t => {
  setup(t);
  sdk.setHandler(async () => { throw new Error('script unavailable'); });
  await assert.rejects(requestPayment(prepared), /결제창을 열지 못했습니다/);
});

test('missing or mismatched SDK response is never treated as received', async t => {
  setup(t);
  for (const response of [undefined, { paymentId: 'another-payment' }]) {
    sdk.setHandler(async () => response);
    assert.equal((await requestPayment(prepared)).status, 'unknown');
  }
});

test('redirect parses received, cancellation, failure and malformed queries without claiming payment completion', () => {
  assert.equal(readPaymentRedirect({ paymentId: prepared.paymentId }).status, 'received');
  assert.equal(readPaymentRedirect({ code: 'Cancelled' }).status, 'cancelled');
  assert.equal(readPaymentRedirect({ code: 'FAILURE_TYPE_PG', message: '사용자가 프로세스를 중단하였습니다.', pgCode: 'CANCEL' }).status, 'cancelled');
  assert.equal(readPaymentRedirect({ code: 'PGProviderError' }).status, 'failed');
  for (const params of [{}, { paymentId: ['a', 'b'] }, { paymentId: 'x'.repeat(65) }, { paymentId: 'a', code: ['a', 'b'] }]) {
    assert.equal(readPaymentRedirect(params).status, 'unknown');
  }
  assert.match(paymentResultMessage(readPaymentResult({ paymentId: prepared.paymentId })), /결제 완료 여부는 아직 확인되지 않았습니다/);
});

test('SDK remains locked across hooks after preparation ends and order stays CREATED', async t => {
  setup(t);
  const c = client();
  const opened = deferred();
  const closing = deferred();
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async url => Response.json(url.endsWith('/verify') ? ready : prepared));
  sdk.setHandler(async () => { calls++; opened.resolve(); return closing.promise; });
  const first = hook(c);
  const result = first.submit();
  await opened.promise;
  await Promise.all([first.submit(), hook(c).submit()]);
  assert.equal(calls, 1);
  closing.resolve({ paymentId: prepared.paymentId });
  await result;
  assert.equal(c.getQueryData(['orders', 7, 51]).status, 'CREATED');
});

test('prepare failure never opens SDK', async t => {
  setup(t);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ detail: '준비 실패' }, { status: 409 }));
  let calls = 0;
  sdk.setHandler(async () => { calls++; });
  await hook(client()).submit();
  assert.equal(calls, 0);
});

test('account switch during preparation prevents SDK opening', async t => {
  setup(t);
  const c = client();
  const started = deferred();
  const pending = deferred();
  t.mock.method(globalThis, 'fetch', () => { started.resolve(); return pending.promise; });
  let calls = 0;
  sdk.setHandler(async () => { calls++; });
  const result = hook(c).submit();
  await started.promise;
  c.setQueryData(['me'], { id: 8 });
  pending.resolve(Response.json(prepared));
  await result;
  assert.equal(calls, 0);
});

test('return page shows an unverified result, payment ID and order history link', async () => {
  const linkUrl = dataUrl(`import React from '${import.meta.resolve('react')}'; export default ({href,children,...props})=>React.createElement('a',{href,...props},children);`);
  const headerUrl = dataUrl('export const Header=()=>null;');
  const { default: Page } = await import(moduleUrl('../src/views/payment-result/ui/payment-result-page.tsx', {
    react: import.meta.resolve('react'), 'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'), 'next/link': linkUrl,
    '@/features/prepare-payment/ui/payment-response-dialog': dataUrl('export const PaymentResponseDialog=()=>null;'),
    '@/features/prepare-payment/model/use-verify-payment-result': dataUrl('export const useVerifyPaymentResult=()=>({});'),
    '@/entities/order/model/use-order': dataUrl('export const useOrder=()=>({});'),
    '@/widgets/header/ui/header': headerUrl, '@/features/prepare-payment/model/payment-result': resultUrl,
  }));
  const html = renderToStaticMarkup(React.createElement(Page, { result: { status: 'received', paymentId: prepared.paymentId } }));
  assert.ok(html.includes(prepared.paymentId));
  assert.ok(html.includes('결제 완료 여부는 아직 확인되지 않았습니다'));
  assert.ok(html.includes('href="/orders"'));
});


test('response details preserve SDK fields and exclude payment tokens', () => {
  const response = { transactionType: 'PAYMENT', paymentId: prepared.paymentId, txId: 'tx-ui-test',
    code: 'FAILURE_TYPE_PG', message: '사용자가 프로세스를 중단하였습니다.', pgCode: 'CANCEL', pgMessage: 'cancel detail', paymentToken: 'must-not-display' };
  const result = readPaymentResult(response);
  assert.equal(result.status, 'cancelled');
  const { paymentToken, ...expected } = response;
  assert.deepEqual(result.response, expected);
  assert.ok(!JSON.stringify(result).includes(paymentToken));
  assert.equal(readPaymentRedirect({ paymentId: prepared.paymentId, txId: 'tx-mobile', pgMessage: 'mobile detail' }).response.txId, 'tx-mobile');
});

test('response dialog displays SDK details, missing fields and unverified notice', async () => {
  const dialogUrl = moduleUrl('../src/shared/ui/dialog.tsx', { react: import.meta.resolve('react'), 'react/jsx-runtime': import.meta.resolve('react/jsx-runtime') });
  const { PaymentResponseDialog } = await import(moduleUrl(`${base}ui/payment-response-dialog.tsx`, {
    'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'), '@/shared/ui/dialog': dialogUrl, '../model/payment-result': resultUrl,
    'next/link': dataUrl(`import React from '${import.meta.resolve('react')}'; export default ({href,children,...props})=>React.createElement('a',{href,...props},children);`),
    './payment-order-items': dataUrl('export const PaymentOrderItems=()=>null;'),
  }));
  const result = readPaymentResult({ paymentId: prepared.paymentId, txId: 'tx-ui-test', transactionType: 'PAYMENT' });
  const render = isOpen => renderToStaticMarkup(React.createElement(PaymentResponseDialog, { result, isOpen, onClose() {} }));
  const html = render(true);
  for (const value of ['role="dialog"', 'aria-modal="true"', '서버 검증 전', prepared.paymentId, 'tx-ui-test', 'PAYMENT', '응답 없음']) assert.ok(html.includes(value), value);
  assert.equal(render(false), '');
  const confirmed = renderToStaticMarkup(React.createElement(PaymentResponseDialog, { result: verifiedPaymentResult(paid), isOpen: true, onClose() {} }));
  for (const value of ['서버 검증 완료', '결제 완료', '117,800', 'tx-verified', '카카오페이']) assert.ok(confirmed.includes(value));
  assert.ok(!confirmed.includes('서버 검증 전'));
});


test('verification API sends credentials and validates paid details and identity', async t => {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.ok(url.endsWith('/api/orders/51/payments/payment-51-test/verify'));
    assert.equal(init.method, 'POST'); assert.equal(init.credentials, 'include');
    return Response.json(paid);
  });
  assert.deepEqual(await verifyPayment(51, prepared.paymentId), paid);
  for (const bad of [{ ...paid, paidAt: null }, { ...paid, totalAmount: 1.5 }, { ...paid, canOpenPaymentWindow: true }, { ...paid, paymentId: 'other' }, { ...paid, orderId: 52 }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(bad));
    await assert.rejects(verifyPayment(51, prepared.paymentId));
  }
});

test('new-tab preparation reuses paid payment without opening SDK', async t => {
  setup(t); const c = client(); let calls = 0;
  sdk.setHandler(async () => { calls++; });
  t.mock.method(globalThis, 'fetch', async url => url.endsWith('/verify') ? Response.json(paid)
    : Response.json(prepared, { status: 200 }));
  await hook(c).submit();
  assert.equal(calls, 0);
  const mutation = c.getMutationCache().getAll().find(m => m.options.mutationKey[0] === 'request-payment');
  assert.equal(mutation.state.data.status, 'verified');
  assert.equal(mutation.state.data.verification.totalAmount, paid.totalAmount);
});

test('already-paid SDK response verifies the original ID and displays server result', async t => {
  setup(t);
  for (const code of ['PAYMENT_ALREADY_PAID', 'PaymentAlreadyPaid']) {
    const c = client(); let checks = 0;
    sdk.setHandler(async () => ({ code, message: '이미 결제된 ID' }));
    t.mock.method(globalThis, 'fetch', async url => Response.json(url.endsWith('/verify') ? (++checks === 1 ? ready : paid) : prepared));
    await hook(c).submit();
    assert.equal(checks, 2);
    const result = c.getMutationCache().getAll().find(m => m.options.mutationKey[0] === 'request-payment').state.data;
    assert.equal(result.status, 'verified'); assert.equal(result.paymentId, prepared.paymentId);
    t.mock.restoreAll();
  }
});

test('provider verification failure never opens SDK or marks the order paid', async t => {
  setup(t); const c = client(); let calls = 0;
  sdk.setHandler(async () => { calls++; });
  t.mock.method(globalThis, 'fetch', async url => url.endsWith('/verify')
    ? Response.json({ detail: '확인 실패' }, { status: 502 }) : Response.json(prepared));
  await hook(c).submit();
  assert.equal(calls, 0); assert.equal(c.getQueryData(['orders', 7, 51]).status, 'CREATED');
  assert.equal(c.getMutationCache().getAll().find(m => m.options.mutationKey[0] === 'request-payment').state.status, 'error');
});

test('unpaid recovery opens the existing payment rather than creating another ID', async t => {
  setup(t); const c = client(); let sdkId;
  sdk.setHandler(async input => { sdkId = input.paymentId; return { code: 'Cancelled' }; });
  t.mock.method(globalThis, 'fetch', async url => url.endsWith('/verify') ? Response.json(ready)
    : Response.json(prepared, { status: 200 }));
  await hook(c).submit();
  assert.equal(sdkId, prepared.paymentId);
});

test('verification by payment ID supports mobile return without an order ID', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    assert.ok(url.endsWith('/api/payments/payment-51-test/verify')); return Response.json(paid);
  });
  assert.deepEqual(await verifyPayment(null, prepared.paymentId), paid);
});

test('verified result contains server fields and is never an unverified success', () => {
  const result = verifiedPaymentResult(paid);
  assert.equal(result.status, 'verified'); assert.equal(result.verification.paidAt, paid.paidAt);
  assert.match(paymentResultMessage(result), /서버에서 결제 완료를 확인/);
});


test('payment product images use the catalog while names and prices stay from the saved order', async () => {
  const { PaymentOrderItems } = await import(moduleUrl(`${base}ui/payment-order-items.tsx`, {
    'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'), '@tanstack/react-query': import.meta.resolve('@tanstack/react-query'),
    '@/lib/api': dataUrl('export const listProducts=()=>{throw new Error("cached products expected");};'),
    '@/entities/product/ui/product-visual': dataUrl(`import React from '${import.meta.resolve('react')}'; export const ProductVisual=({product})=>React.createElement('img',{src:product.imageUrl,alt:product.name});`),
  }));
  const c = client();
  c.setQueryData(['products'], [{ id: 42, name: '현재 상품명', price: 999999, imageUrl: 'https://example.com/product.jpg' }]);
  const order = { items: [{ productId: 42, productName: '주문 당시 상품명', unitPrice: 1200, quantity: 2, lineTotal: 2400 }] };
  const html = renderToStaticMarkup(React.createElement(QueryClientProvider, { client: c }, React.createElement(PaymentOrderItems, { order })));
  for (const value of ['https://example.com/product.jpg', '주문 당시 상품명', '1,200', '2,400']) assert.ok(html.includes(value));
  assert.ok(!html.includes('현재 상품명')); assert.ok(!html.includes('999999'));
});


test('payment cannot start while a cancellation for the same order is in flight', async t => {
  setup(t);
  const c = client();
  const started = deferred();
  const release = deferred();
  const mutation = c.getMutationCache().build(c, {
    mutationKey: ['cancel-order', 7, 51], mutationFn: () => { started.resolve(); return release.promise; },
  });
  const task = mutation.execute();
  await started.promise;
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('must not fetch'); });
  try { await hook(c).submit(); assert.equal(fetch.mock.callCount(), 0); }
  finally { release.resolve(); await task; }
});

test('closing or failing the payment window keeps the order and only requests payment retry',async t=>{
  setup(t);
  for(const response of [{code:'Cancelled',paymentId:prepared.paymentId},{code:'PGProviderError',paymentId:prepared.paymentId}]) {
    const c=client(), paths=[];
    t.mock.method(globalThis,'fetch',async url=>{
      paths.push(new URL(url).pathname);
      if(url.endsWith('/release-reservation'))return Response.json({orderId:51,orderStatus:'CREATED',inventoryStatus:'REVIEW_REQUIRED',pending:true},{status:202});
      return Response.json(url.endsWith('/verify')?ready:prepared);
    });
    sdk.setHandler(async()=>response);
    await hook(c).submit();
    assert.equal(c.getQueryData(['orders',7,51]).status,'CREATED');
    assert.ok(paths.includes('/api/orders/51/payments/release-reservation'));
    assert.ok(!paths.includes('/api/orders/51/payments/cancel'));
    t.mock.restoreAll();
  }
});
