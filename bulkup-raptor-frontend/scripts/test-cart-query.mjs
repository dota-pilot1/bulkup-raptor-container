import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { QueryClient, QueryObserver } from '@tanstack/react-query';

const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
function moduleUrl(path, imports = {}) {
  let { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  for (const [name, url] of Object.entries(imports)) outputText = outputText.replaceAll(`"${name}"`, `"${url}"`);
  return dataUrl(outputText);
}
const apiUrl = moduleUrl('../src/shared/api/client.ts');
const getCartUrl = moduleUrl('../src/entities/cart/api/get-cart.ts', { '@/shared/api/client': apiUrl });
const { getCart } = await import(getCartUrl);
const { ApiError } = await import(apiUrl);
const { useCart } = await import(moduleUrl('../src/entities/cart/model/use-cart.ts', {
  '@tanstack/react-query': dataUrl('export function useQuery(options) { return options; }'),
  '../api/get-cart': getCartUrl,
  './query-keys': moduleUrl('../src/entities/cart/model/query-keys.ts'),
}));
const cart = { items: [], totalQuantity: 4, totalAmount: 10000 };
const client = () => new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });

function observeUntil(observer, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unsubscribe(); reject(new Error('Query timeout')); }, 2000);
    const unsubscribe = observer.subscribe(result => {
      if (predicate(result)) { clearTimeout(timer); unsubscribe(); resolve(result); }
    });
  });
}

test('GET sends credentials and returns the server cart', async t => {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(new URL(url).pathname, '/api/cart');
    assert.equal(init.credentials, 'include');
    assert.equal(init.method ?? 'GET', 'GET');
    return Response.json(cart);
  });
  assert.deepEqual(await getCart(), cart);
});

test('anonymous query is disabled and login enables a member-scoped server query', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(cart));
  const qc = client();
  const observer = new QueryObserver(qc, useCart(null));
  const unsub = observer.subscribe(() => {});
  assert.equal(mock.mock.callCount(), 0);
  assert.equal(observer.getCurrentResult().fetchStatus, 'idle');
  const loaded = observeUntil(observer, result => result.isSuccess);
  observer.setOptions(useCart(7));
  assert.deepEqual((await loaded).data, cart);
  assert.deepEqual(qc.getQueryData(['cart', 7]), cart);
  assert.equal(qc.getQueryData(['cart', null]), undefined);
  unsub();
});

test('failed requests preserve the error instead of manufacturing an empty cart', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({detail:'서버 오류'}, {status:503}));
  const observer = new QueryObserver(client(), useCart(7));
  const failed = await observeUntil(observer, result => result.isError);
  assert.equal(mock.mock.callCount(), 1);
  assert.equal(failed.data, undefined);
  assert.ok(failed.error instanceof ApiError);
  assert.equal(failed.error.status, 503);
});

test('changing members keeps cached data isolated and returns the new member cart', async t => {
  const qc = client();
  qc.setQueryData(['cart', 7], cart);
  const otherCart = {items: [], totalQuantity: 0, totalAmount: 0};
  t.mock.method(globalThis, 'fetch', async () => Response.json(otherCart));
  const observer = new QueryObserver(qc, useCart(7));
  const unsub = observer.subscribe(() => {});
  const loaded = observeUntil(observer, result => result.isSuccess && result.data?.totalQuantity === 0);
  observer.setOptions(useCart(8));
  assert.deepEqual((await loaded).data, otherCart);
  assert.deepEqual(qc.getQueryData(['cart', 7]), cart);
  assert.deepEqual(qc.getQueryData(['cart', 8]), otherCart);
  unsub();
});

test('AbortSignal reaches fetch when a cart query is cancelled', async t => {
  let receivedSignal;
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  t.mock.method(globalThis, 'fetch', (_url, init) => {
    receivedSignal = init.signal;
    started();
    return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
  });
  const qc = client();
  const query = qc.fetchQuery(useCart(7)).catch(() => undefined);
  await ready;
  await qc.cancelQueries({queryKey:['cart',7]});
  await query;
  assert.equal(receivedSignal.aborted, true);
});
