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

const deleteUrl = moduleUrl('../src/features/delete-cart-item/api/delete-cart-item.ts', { '@/shared/api/client': clientUrl });
const { useDeleteCartItem } = await import(moduleUrl('../src/features/delete-cart-item/model/use-delete-cart-item.ts', {
  react: import.meta.resolve('react'),
  '@tanstack/react-query': import.meta.resolve('@tanstack/react-query'),
  '@/entities/cart/model/query-keys': moduleUrl('../src/entities/cart/model/query-keys.ts'),
  '@/entities/cart/api/get-cart': getUrl,
  '@/shared/api/client': clientUrl,
  '@/shared/ui/toast': toastUrl,
  '../api/delete-cart-item': deleteUrl,
}));
function hook(client) {
  let result;
  function Probe() { result = useDeleteCartItem(); return null; }
  renderToString(React.createElement(QueryClientProvider, { client }, React.createElement(Probe)));
  return result;
}
const empty = { items: [], totalQuantity: 0, totalAmount: 0 };

test('DELETE accepts 204 then refreshes totals and last-item empty state', async t => {
  const client = queryClient(); client.setQueryData(['cart',7],cart);
  const methods=[];
  t.mock.method(globalThis,'fetch',async(url,init)=>{
    methods.push(init.method??'GET');
    assert.equal(init.credentials,'include');
    if(init.method==='DELETE') {
      assert.equal(new URL(url).pathname,'/api/cart/items/3');
      return new Response(null,{status:204});
    }
    return Response.json(empty);
  });
  await hook(client).remove(3);
  assert.deepEqual(methods,['DELETE','GET']);
  assert.deepEqual(client.getQueryData(['cart',7]),empty);
});

test('duplicate delete is blocked through refresh',async t=>{
  const client=queryClient();const pending=deferred();const started=deferred();const methods=[];
  t.mock.method(globalThis,'fetch',async(_url,init)=>{
    methods.push(init.method??'GET');
    if(init.method==='DELETE')return new Response(null,{status:204});
    started.resolve();return pending.promise;
  });
  const result=hook(client).remove(3);await started.promise;
  await hook(client).remove(3);
  assert.equal(client.isMutating({mutationKey:['cart-write']}),1);
  assert.deepEqual(methods,['DELETE','GET']);
  pending.resolve(Response.json(empty));await result;
});

test('401 clears the session and member carts',async t=>{
  const client=queryClient();client.setQueryData(['cart',7],cart);
  t.mock.method(globalThis,'fetch',async()=>Response.json({detail:'로그인 필요'},{status:401}));
  await hook(client).remove(3);
  assert.equal(client.getQueryData(['me']),null);
  assert.equal(client.getQueryData(['cart',7]),undefined);
});

for(const failure of ['lost',404,500]) test(`delete failure ${failure} reconciles with GET without resubmission`,async t=>{
  const client=queryClient();const methods=[];
  t.mock.method(globalThis,'fetch',async(_url,init)=>{
    methods.push(init.method??'GET');
    if(init.method==='DELETE') {
      if(failure==='lost')throw new TypeError('Failed to fetch');
      return Response.json({detail:'삭제 오류'},{status:failure});
    }
    return Response.json(empty);
  });
  await hook(client).remove(3);
  assert.deepEqual(methods,['DELETE','GET']);
  assert.deepEqual(client.getQueryData(['cart',7]),empty);
});

test('successful delete with failed refresh exposes query error for retry',async t=>{
  const client=queryClient();client.setQueryData(['cart',7],cart);
  t.mock.method(globalThis,'fetch',async(_url,init)=>init.method==='DELETE'
    ?new Response(null,{status:204}):Response.json({detail:'조회 실패'},{status:500}));
  await hook(client).remove(3);
  assert.equal(client.getQueryState(['cart',7]).status,'error');
  assert.match(messages.at(-1).message,/삭제되었습니다/);
});

test('late delete response after account change cannot populate carts',async t=>{
  const client=queryClient();const pending=deferred();const started=deferred();
  const mock=t.mock.method(globalThis,'fetch',()=>{started.resolve();return pending.promise;});
  const result=hook(client).remove(3);await started.promise;
  client.setQueryData(['me'],{id:8});pending.resolve(new Response(null,{status:204}));await result;
  assert.equal(mock.mock.callCount(),1);
  assert.equal(client.getQueryData(['cart',8]),undefined);
  assert.deepEqual(messages,[]);
});
