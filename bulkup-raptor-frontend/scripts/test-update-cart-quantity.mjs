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
function addHook(client) {
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

const updateUrl = moduleUrl('../src/features/update-cart-item-quantity/api/update-cart-item-quantity.ts', { '@/shared/api/client': clientUrl });
const { updateCartItemQuantity } = await import(updateUrl);
const { useUpdateCartItemQuantity } = await import(moduleUrl('../src/features/update-cart-item-quantity/model/use-update-cart-item-quantity.ts', {
  react: import.meta.resolve('react'),
  '@tanstack/react-query': import.meta.resolve('@tanstack/react-query'),
  '@/entities/cart/model/query-keys': moduleUrl('../src/entities/cart/model/query-keys.ts'),
  '@/entities/cart/api/get-cart': getUrl,
  '@/shared/api/client': clientUrl,
  '@/shared/ui/toast': toastUrl,
  '../api/update-cart-item-quantity': updateUrl,
}));
function hook(client) {
  let result;
  function Probe() { result = useUpdateCartItemQuantity(); return null; }
  renderToString(React.createElement(QueryClientProvider, { client }, React.createElement(Probe)));
  return result;
}
const updated = {items:[{...cart.items[0], quantity:3, lineTotal:3600}], totalQuantity:3, totalAmount:3600};

test('PATCH sends item ID, final quantity and cookie, then returns the server cart', async t => {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(new URL(url).pathname, '/api/cart/items/3');
    assert.equal(init.method, 'PATCH');
    assert.equal(init.credentials, 'include');
    assert.deepEqual(JSON.parse(init.body), {quantity:3});
    return Response.json(updated);
  });
  assert.deepEqual(await updateCartItemQuantity(3,3), updated);
});

test('success replaces the member cart, not optimistically, and does not GET again', async t => {
  const client = queryClient(); client.setQueryData(['cart',7],cart);
  const pending = deferred(); const started = deferred();
  const mock = t.mock.method(globalThis,'fetch', () => {started.resolve();return pending.promise;});
  const result = hook(client).update(3,3);
  await started.promise;
  assert.deepEqual(client.getQueryData(['cart',7]),cart);
  pending.resolve(Response.json(updated)); await result;
  assert.deepEqual(client.getQueryData(['cart',7]),updated);
  assert.equal(client.getQueryData(['cart',7]).items.length,1);
  assert.equal(mock.mock.callCount(),1);
});

test('rapid clicks and separate hook instances cannot submit duplicate updates', async t => {
  const client=queryClient(); const pending=deferred(); const started=deferred();
  const mock=t.mock.method(globalThis,'fetch',()=>{started.resolve();return pending.promise;});
  const first=hook(client);const second=hook(client);
  const result=first.update(3,3); await started.promise;
  await Promise.all([first.update(3,3),second.update(3,4)]);
  assert.equal(mock.mock.callCount(),1);
  pending.resolve(Response.json(updated)); await result;
});

test('out-of-range, fractional and anonymous updates send no request', async t => {
  const mock=t.mock.method(globalThis,'fetch',()=>{throw new Error('Must not fetch');});
  const client=queryClient();const {update}=hook(client);
  for(const quantity of [0,100,-1,1.5,NaN,Infinity]) await update(3,quantity);
  await hook(queryClient(null)).update(3,2);
  assert.equal(mock.mock.callCount(),0);
});

test('400 preserves the saved cart and controls recover for a subsequent change',async t=>{
  const client=queryClient();client.setQueryData(['cart',7],cart);let calls=0;
  t.mock.method(globalThis,'fetch',async()=>++calls===1?Response.json({detail:'수량 범위 오류'},{status:400}):Response.json(updated));
  const {update}=hook(client);await update(3,3);
  assert.deepEqual(client.getQueryData(['cart',7]),cart);
  assert.match(messages[0].message,/수량 범위 오류/);
  await update(3,3); assert.deepEqual(client.getQueryData(['cart',7]),updated);
});

test('401 clears authentication and cart data',async t=>{
  const client=queryClient();client.setQueryData(['cart',7],cart);
  t.mock.method(globalThis,'fetch',async()=>Response.json({detail:'로그인 필요'},{status:401}));
  await hook(client).update(3,3);
  assert.equal(client.getQueryData(['me']),null);assert.equal(client.getQueryData(['cart',7]),undefined);
  assert.match(messages[0].message,/다시 로그인/);
});

test('404 refreshes deleted items without retrying PATCH',async t=>{
  const client=queryClient();client.setQueryData(['cart',7],cart);const methods=[];
  const empty={items:[],totalQuantity:0,totalAmount:0};
  t.mock.method(globalThis,'fetch',async(_url,init)=>{
    methods.push(init.method??'GET');
    return init.method==='PATCH'?Response.json({detail:'항목 없음'},{status:404}):Response.json(empty);
  });
  await hook(client).update(3,3);
  assert.deepEqual(methods,['PATCH','GET']);assert.deepEqual(client.getQueryData(['cart',7]),empty);
});

test('lost PATCH response verifies the saved result with GET rather than resubmitting',async t=>{
  const client=queryClient();client.setQueryData(['cart',7],cart);const methods=[];
  t.mock.method(globalThis,'fetch',async(_url,init)=>{
    methods.push(init.method??'GET');if(init.method==='PATCH')throw new TypeError('Failed to fetch');
    return Response.json(updated);
  });
  await hook(client).update(3,3);
  assert.deepEqual(methods,['PATCH','GET']);assert.deepEqual(client.getQueryData(['cart',7]),updated);
});

test('late result after login change never populates either member cart',async t=>{
  const client=queryClient();const pending=deferred();const started=deferred();
  t.mock.method(globalThis,'fetch',()=>{started.resolve();return pending.promise;});
  const result=hook(client).update(3,3);await started.promise;
  client.setQueryData(['me'],{id:8});pending.resolve(Response.json(updated));await result;
  assert.equal(client.getQueryData(['cart',7]),undefined);assert.equal(client.getQueryData(['cart',8]),undefined);
  assert.deepEqual(messages,[]);
});

test('add shares update scope so its newer complete response wins',async t=>{
  const client=queryClient();const pending=deferred();const started=deferred();const methods=[];
  const added={...updated,items:[...updated.items,{...cart.items[0],id:4}]};
  t.mock.method(globalThis,'fetch',async(_url,init)=>{
    methods.push(init.method);if(init.method==='PATCH'){started.resolve();return pending.promise;}
    return Response.json(added);
  });
  const updating=hook(client).update(3,3);await started.promise;
  const adding=addHook(client).add(11);assert.deepEqual(methods,['PATCH']);
  pending.resolve(Response.json(updated));await Promise.all([updating,adding]);
  assert.deepEqual(methods,['PATCH','POST']);assert.deepEqual(client.getQueryData(['cart',7]),added);
});

test('stale GET is cancelled before the PATCH response is cached',async t=>{
  const client=queryClient();const old=deferred();const started=deferred();let signal;
  t.mock.method(globalThis,'fetch',(_url,init)=>{
    if(init.method==='PATCH')return Promise.resolve(Response.json(updated));
    signal=init.signal;started.resolve();return old.promise;
  });
  const reading=client.fetchQuery({queryKey:['cart',7],queryFn:({signal})=>getCart(signal),retry:false}).catch(()=>undefined);
  await started.promise;await hook(client).update(3,3);assert.equal(signal.aborted,true);
  old.resolve(Response.json(cart));await reading;
  assert.deepEqual(client.getQueryData(['cart',7]),updated);
});
