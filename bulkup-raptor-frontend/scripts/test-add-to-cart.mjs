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
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  for (const [name, url] of Object.entries(imports)) outputText = outputText.replaceAll(`"${name}"`, `"${url}"`);
  return dataUrl(outputText);
}
const clientUrl = moduleUrl('../src/shared/api/client.ts');
const addUrl = moduleUrl('../src/features/add-to-cart/api/add-cart-item.ts', { '@/shared/api/client': clientUrl });
const getUrl = moduleUrl('../src/entities/cart/api/get-cart.ts', { '@/shared/api/client': clientUrl });
const toastUrl = dataUrl(`export const messages = []; export const useToast = () => ({success: message => messages.push({kind:'success',message}), error: message => messages.push({kind:'error',message})});`);
const { messages } = await import(toastUrl);
const { addCartItem } = await import(addUrl);
const { getCart } = await import(getUrl);
const { ApiError } = await import(clientUrl);
const { useAddCartItem } = await import(moduleUrl('../src/features/add-to-cart/model/use-add-cart-item.ts', {
  react: import.meta.resolve('react'),
  '@tanstack/react-query': import.meta.resolve('@tanstack/react-query'),
  '@/entities/cart/model/query-keys': moduleUrl('../src/entities/cart/model/query-keys.ts'),
  '@/lib/api': dataUrl('export async function currentMember() { throw new Error("Unexpected member fetch"); }'),
  '@/shared/api/client': clientUrl,
  '@/shared/ui/toast': toastUrl,
  '../api/add-cart-item': addUrl,
}));
const member = { id: 7, name: '회원' };
const cart = { items: [{ id: 3, product: { id: 10, name: '상품', price: 1200 }, quantity: 1, lineTotal: 1200 }], totalQuantity: 1, totalAmount: 1200 };
function queryClient(session = member) {
  messages.length = 0;
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  client.setQueryData(['me'], session);
  return client;
}
function hook(client) {
  let result;
  function Probe() { result = useAddCartItem(); return null; }
  renderToString(React.createElement(QueryClientProvider, { client }, React.createElement(Probe)));
  return result;
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('API sends only productId and quantity with login cookie and returns server cart', async t => {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(new URL(url).pathname, '/api/cart/items');
    assert.equal(init.method, 'POST');
    assert.equal(init.credentials, 'include');
    assert.deepEqual(JSON.parse(init.body), { productId: 10, quantity: 1 });
    return Response.json(cart);
  });
  assert.deepEqual(await addCartItem(10), cart);
});

test('API preserves status and server detail without retrying', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({detail:'수량 상한 초과'}, {status:400}));
  await assert.rejects(addCartItem(10), error => error instanceof ApiError && error.status === 400 && error.message === '수량 상한 초과');
  assert.equal(mock.mock.callCount(), 1);
});

test('rapid calls submit once and cache the full response under the member key', async t => {
  const client = queryClient();
  const request = deferred();
  const mock = t.mock.method(globalThis, 'fetch', () => request.promise);
  const { add } = hook(client);
  const first = add(10);
  const duplicate = add(10);
  request.resolve(Response.json(cart));
  await Promise.all([first, duplicate]);
  assert.equal(mock.mock.callCount(), 1);
  assert.deepEqual(client.getQueryData(['cart', member.id]), cart);
  assert.equal(client.getQueryData(['cart']), undefined);
  assert.equal(messages.filter(m => m.kind === 'success').length, 1);
});

test('anonymous click shows login guidance without sending a POST', async t => {
  const mock = t.mock.method(globalThis, 'fetch', () => { throw new Error('Must not fetch'); });
  await hook(queryClient(null)).add(10);
  assert.equal(mock.mock.callCount(), 0);
  assert.match(messages[0].message, /로그인 후/);
});

test('late response after account switch cannot cache or display success', async t => {
  const client = queryClient();
  const request = deferred();
  const started = deferred();
  t.mock.method(globalThis, 'fetch', () => { started.resolve(); return request.promise; });
  const pending = hook(client).add(10);
  await started.promise;
  client.setQueryData(['me'], { id: 8, name: '다른 회원' });
  request.resolve(Response.json(cart));
  await pending;
  assert.equal(client.getQueryData(['cart', 7]), undefined);
  assert.equal(client.getQueryData(['cart', 8]), undefined);
  assert.deepEqual(messages, []);
});

test('expired session clears member/cart caches and explains login', async t => {
  const client = queryClient();
  client.setQueryData(['cart', 7], cart);
  t.mock.method(globalThis, 'fetch', async () => Response.json({detail:'로그인이 필요합니다.'}, {status:401}));
  await hook(client).add(10);
  assert.equal(client.getQueryData(['me']), null);
  assert.equal(client.getQueryData(['cart', 7]), undefined);
  assert.match(messages[0].message, /다시 로그인/);
});

test('network error is not retried and warns to verify saved data before adding again', async t => {
  const client = queryClient();
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch'); });
  await hook(client).add(10);
  assert.equal(mock.mock.callCount(), 1);
  assert.equal(client.getQueryData(['cart', 7]), undefined);
  assert.match(messages[0].message, /저장 여부를 확인/);
});

test('separate product hooks serialize requests and preserve the newest full-cart response', async t => {
  const client = queryClient();
  const firstResponse = deferred();
  const firstStarted = deferred();
  const merged = { ...cart, totalQuantity: 2, totalAmount: 2400 };
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    if (calls === 1) { firstStarted.resolve(); return firstResponse.promise; }
    return Response.json(merged);
  });
  const first = hook(client).add(10);
  await firstStarted.promise;
  const second = hook(client).add(11);
  assert.equal(calls, 1);
  firstResponse.resolve(Response.json(cart));
  await Promise.all([first, second]);
  assert.equal(calls, 2);
  assert.deepEqual(client.getQueryData(['cart', 7]), merged);
});

test('older in-flight cart GET cannot overwrite the successful add response', async t => {
  const client = queryClient();
  const oldResponse = deferred();
  const started = deferred();
  let signal;
  t.mock.method(globalThis, 'fetch', (_url, init) => {
    if (init.method === 'POST') return Promise.resolve(Response.json(cart));
    signal = init.signal;
    started.resolve();
    return oldResponse.promise;
  });
  const oldQuery = client.fetchQuery({
    queryKey: ['cart', member.id], queryFn: ({signal}) => getCart(signal), retry: false,
  }).catch(() => undefined);
  await started.promise;
  await hook(client).add(10);
  assert.equal(signal.aborted, true);
  oldResponse.resolve(Response.json({ items: [], totalQuantity: 0, totalAmount: 0 }));
  await oldQuery;
  assert.deepEqual(client.getQueryData(['cart', member.id]), cart);
});
