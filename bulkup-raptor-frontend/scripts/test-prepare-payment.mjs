import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToString, renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
function moduleUrl(path, imports = {}, suffix = '') {
  let { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  for (const [name, url] of Object.entries(imports)) outputText = outputText.replaceAll(`"${name}"`, `"${url}"`);
  return dataUrl(outputText + suffix);
}
const base = '../src/features/prepare-payment/';
const clientUrl = moduleUrl('../src/shared/api/client.ts');
const typesUrl = moduleUrl(`${base}model/payment-types.ts`, { zod: import.meta.resolve('zod') });
const apiUrl = moduleUrl(`${base}api/prepare-payment.ts`, {
  '@/shared/api/client': clientUrl, '../model/payment-types': typesUrl,
});
const { preparePayment } = await import(apiUrl);
const { usePreparePayment } = await import(moduleUrl(`${base}model/use-prepare-payment.ts`, {
  react: import.meta.resolve('react'), '@tanstack/react-query': import.meta.resolve('@tanstack/react-query'),
  '@/shared/api/client': clientUrl, '../api/prepare-payment': apiUrl,
}));
const response = { paymentId: 'payment-51-test', orderName: '서버 주문명 외 1종', totalAmount: 117800, currency: 'KRW' };
const member = { id: 7, name: '회원' };
function client(session = member) {
  const c = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  c.setQueryData(['me'], session);
  return c;
}
function hook(c, memberId = 7, orderId = 51) {
  let value;
  function Probe() { value = usePreparePayment(memberId, orderId); return null; }
  renderToString(React.createElement(QueryClientProvider, { client: c }, React.createElement(Probe)));
  return value;
}
function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

test('prepare sends only order ID in URL and login cookie without a body', async t => {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(new URL(url).pathname, '/api/orders/51/payments');
    assert.equal(init.method, 'POST');
    assert.equal(init.credentials, 'include');
    assert.equal(init.body, undefined);
    return Response.json(response, { status: 201 });
  });
  assert.deepEqual(await preparePayment(51), response);
});

test('unusable server responses fail instead of displaying payment ready', async t => {
  for (const invalid of [null, {}, { ...response, paymentId: '' }, { ...response, currency: 'USD' },
    { ...response, totalAmount: -1 }, { ...response, totalAmount: 1.5 }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(invalid));
    await assert.rejects(preparePayment(51), /결제 정보를 확인하지 못했습니다/);
    t.mock.restoreAll();
  }
});

test('rapid clicks across mounted hook instances produce one request', async t => {
  const c = client();
  const started = deferred();
  const pending = deferred();
  let count = 0;
  t.mock.method(globalThis, 'fetch', () => { count++; started.resolve(); return pending.promise; });
  const first = hook(c);
  const result = first.submit();
  await started.promise;
  await Promise.all([first.submit(), hook(c).submit()]);
  assert.equal(count, 1);
  pending.resolve(Response.json(response));
  assert.deepEqual(await result, response);
});

test('lost responses and reloads recheck the same order without browser storage', async t => {
  const c = client();
  const urls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    urls.push(url);
    assert.equal(init.body, undefined);
    if (urls.length === 1) throw new TypeError('response lost');
    if (urls.length === 2) return Response.json({ detail: '서버 오류' }, { status: 500 });
    return Response.json(response);
  });
  assert.equal(await hook(c).submit(), null);
  assert.equal(urls.length, 1, 'automatic retries are disabled');
  assert.equal(await hook(c).submit(), null);
  assert.deepEqual(await hook(c).submit(), response);
  assert.deepEqual(await hook(client()).submit(), response);
  assert.equal(new Set(urls).size, 1);
  assert.equal(c.getQueryData(['orders', 7, 51]), undefined, 'preparation does not mark an order paid');
});

test('anonymous or changed account and invalid order IDs cannot send a request', async t => {
  const mock = t.mock.method(globalThis, 'fetch', () => { throw new Error('must not call'); });
  await hook(client(null)).submit();
  await hook(client({ id: 8 })).submit();
  for (const orderId of [0, -1, NaN, 1.2]) await hook(client(), 7, orderId).submit();
  assert.equal(mock.mock.callCount(), 0);
});

test('late success after account switch returns no previous member payment', async t => {
  const c = client();
  const started = deferred();
  const pending = deferred();
  t.mock.method(globalThis, 'fetch', () => { started.resolve(); return pending.promise; });
  const result = hook(c).submit();
  await started.promise;
  c.setQueryData(['me'], { id: 8 });
  pending.resolve(Response.json(response));
  assert.equal(await result, null);
  assert.equal(hook(c, 8).data, undefined);
});

test('401 expires the current session and discards private order cache', async t => {
  const c = client();
  c.setQueryData(['orders', 7, 51], { orderId: 51 });
  t.mock.method(globalThis, 'fetch', async () => Response.json({ detail: '로그인 필요' }, { status: 401 }));
  assert.equal(await hook(c).submit(), null);
  assert.equal(c.getQueryData(['me']), null);
  assert.equal(c.getQueryData(['orders', 7, 51]), undefined);
});

test('button renders pending, failed and prepared states without a preview dialog', async () => {
  const stateUrl = dataUrl('export let state={};export const setState=x=>state=x;export const useRequestPayment=()=>state;');
  const { setState } = await import(stateUrl);
  const { PreparePaymentButton } = await import(moduleUrl(`${base}ui/prepare-payment-button.tsx`, {
    react: import.meta.resolve('react'), 'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'), './payment-response-dialog': dataUrl('export const PaymentResponseDialog=()=>null;'), '../model/use-request-payment': stateUrl, '../model/payment-result': moduleUrl(`${base}model/payment-result.ts`),
  }));
  const render = () => renderToStaticMarkup(React.createElement(PreparePaymentButton, { memberId: 7, order: { orderId: 51, status: 'CREATED', totalAmount: 117800 } }));
  setState({ isPending: true, isPreparing: true });
  assert.match(render(), /disabled=""/);
  assert.match(render(), /결제 정보 확인 중/);
  setState({ error: new Error('failed') });
  assert.match(render(), /role="alert"/);
  assert.match(render(), /결제 상태 다시 확인/);
  setState({ data: response });
  const html = render();
  for (const text of ['결제 준비 완료', '서버 주문명 외 1종', '117,800', '결제 완료 여부는 별도로 확인합니다']) assert.ok(html.includes(text));
  assert.ok(!html.includes('dialog'));
  assert.ok(html.includes(response.paymentId));
  assert.ok(html.includes('KRW'));
});
